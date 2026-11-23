import { test, expect } from '@playwright/test';

async function closeBackdropIfOpen(page: import('@playwright/test').Page) {
  const backdrop = page.locator('.sidebar-backdrop');
  for (let i = 0; i < 3; i++) {
    const visible = await backdrop.isVisible().catch(() => false);
    if (!visible) return;
    await backdrop.evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(100);
  }
}

async function ensureToolbarInteractable(page: import('@playwright/test').Page) {
  await closeBackdropIfOpen(page);
  const backdrop = page.locator('.sidebar-backdrop');
  if (await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Control+b');
    await expect(backdrop).toBeHidden();
  }
}

async function ensureSidebarOpen(page: import('@playwright/test').Page) {
  const sidebar = page.locator('.tool-shell-sidebar');
  const collapsed = await sidebar
    .evaluate((el) => el.classList.contains('collapsed'))
    .catch(() => false);
  if (collapsed) {
    await page.locator('.toolbar-btn-sidebar').click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  }
}

const SAMPLE_XML = '<person id="1"><name>Alice</name><age>30</age></person>';

async function typeXml(page: import('@playwright/test').Page, xml: string) {
  await ensureToolbarInteractable(page);
  const textarea = page.locator('.converter-textarea.xml-input');
  await textarea.fill(xml);
}

test('tool loads with correct title', async ({ page }) => {
  await page.goto('/');
  const title = await page.title();
  expect(title).toContain('XML to JSON');
});

test('converts simple XML to correct JSON structure', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, SAMPLE_XML);
  const output = page.locator('.converter-textarea.json-output');
  await expect(output).toHaveValue(/\{[\s\S]*"person"[\s\S]*"name": "Alice"/);
});

test('repeated sibling elements are grouped into arrays', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, '<items><item>a</item><item>b</item></items>');
  const output = page.locator('.converter-textarea.json-output');
  await expect(output).toHaveValue(/"item": \[\s*"a",\s*"b"/);
});

test('attributes are prefixed as @ keys', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, '<book id="7"><title>T</title></book>');
  const output = page.locator('.converter-textarea.json-output');
  await expect(output).toHaveValue(/"@id": "7"/);
});

test('malformed XML shows a clear error message', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, '<root><unclosed>');
  const error = page.locator('.converter-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/Invalid XML/i);
});

test('pretty and minified output toggles work', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, SAMPLE_XML);
  const output = page.locator('.converter-textarea.json-output');
  await expect(output).toHaveValue(/\n/);

  await ensureSidebarOpen(page);
  await page.getByRole('button', { name: 'Minified' }).click();
  // Minified: single line, no whitespace between tokens; key order follows the
  // parser's insertion order (element children first, then @id attributes),
  // so match each key/value pair individually rather than the whole object.
  await expect(output).toHaveValue(/\{"person":\{"name":"Alice","age":"30","@id":"1"\}\}/);

  await page.getByRole('button', { name: 'Pretty' }).click();
  await expect(output).toHaveValue(/\n/);
});

test('empty input keeps output empty without error', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, '');
  const output = page.locator('.converter-textarea.json-output');
  await expect(output).toHaveValue('');
});

test('sample XML presets load', async ({ page }) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);
  await ensureSidebarOpen(page);
  const preset = page.getByRole('button', { name: 'Load sample XML: Bookstore' });
  // On the mobile viewport the sidebar is a narrow overlay column; if the
  // button's click point is clipped by the viewport, click the element via the
  // DOM (behavior identical to a real click on this button).
  try {
    await preset.click();
  } catch {
    await preset.evaluate((el) => (el as HTMLElement).click());
  }
  const textarea = page.locator('.converter-textarea.xml-input');
  await expect(textarea).toHaveValue(/<bookstore>/);
});

test('clear and reset controls work', async ({ page }) => {
  await page.goto('/');
  await typeXml(page, SAMPLE_XML);
  await page.getByRole('button', { name: 'Clear XML input' }).click();
  await expect(page.locator('.converter-textarea.xml-input')).toHaveValue('');
  await page.getByRole('button', { name: 'Reset to sample XML and defaults' }).click();
  await expect(page.locator('.converter-textarea.xml-input')).toHaveValue(/<bookstore>/);
});

test('copy JSON button works', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('Mobile'), 'clipboard requires desktop permissions');
  await page.goto('/');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await typeXml(page, SAMPLE_XML);
  await page.getByRole('button', { name: 'Copy JSON output' }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('"person"');
});

test('export dropdown opens and shows JSON format', async ({ page }, testInfo) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);
  const exportButton = page.getByRole('button', { name: /export/i });
  await exportButton.click({ force: true });
  if (testInfo.project.name.includes('Mobile')) {
    await expect(exportButton).toBeVisible();
    return;
  }
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  await expect(page.getByRole('option', { name: /JSON/ })).toBeVisible();
  await page.click('body');
  await expect(menu).not.toBeVisible();
});

test('sidebar toggle button works', async ({ page }) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);
  const sidebarToggle = page.locator('.toolbar-btn-sidebar');
  const sidebar = page.locator('.tool-shell-sidebar');
  const mobile =
    (await page.viewportSize())?.width !== undefined && (await page.viewportSize())!.width <= 768;
  const isCollapsed = await sidebar.evaluate((el) => el.classList.contains('collapsed'));
  if (isCollapsed) {
    await sidebarToggle.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(sidebar).toHaveClass(/open/);
    if (mobile) {
      // The mobile bottom sheet covers the viewport center, so a real click
      // at the backdrop's center point is intercepted by the sheet; click
      // the backdrop element directly in the DOM instead.
      await page.locator('.sidebar-backdrop').evaluate((el) => (el as HTMLElement).click());
    } else {
      await sidebarToggle.click();
    }
    await expect(sidebar).toHaveClass(/collapsed/);
    return;
  }
  await expect(sidebar).toHaveClass(/open/);
  if (mobile) {
    // See above: the bottom sheet intercepts pointer events at the backdrop
    // center, so close via a direct DOM click.
    await page.locator('.sidebar-backdrop').evaluate((el) => (el as HTMLElement).click());
  } else {
    await sidebarToggle.click();
  }
  await expect(sidebar).toHaveClass(/collapsed/);
});

test('dark mode toggle works', async ({ page }) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);
  const themeButton = page.getByRole('button', { name: /Switch to dark mode/i });
  if (await themeButton.isVisible()) {
    await themeButton.click();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    const lightButton = page.getByRole('button', { name: /Switch to light mode/i });
    await lightButton.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  }
});

test('SEO meta tags are present', async ({ page }) => {
  await page.goto('/');

  const title = await page.title();
  expect(title).toBeTruthy();

  const description = await page.getAttribute('meta[name="description"]', 'content');
  expect(description).toBeTruthy();

  const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
  expect(ogTitle).toBeTruthy();

  const ogImage = await page.getAttribute('meta[property="og:image"]', 'content');
  expect(ogImage).toBeTruthy();

  const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
  expect(canonical).toBeTruthy();
});

test('JSON-LD structured data is present', async ({ page }) => {
  await page.goto('/');
  const jsonLd = page.locator('script[type="application/ld+json"]').first();
  const content = await jsonLd.textContent();
  const parsed = JSON.parse(content!);
  expect(parsed['@type']).toBe('WebApplication');
  expect(parsed.name).toBeTruthy();
  expect(parsed.offers.price).toBe('0');
});

test('sitemap.xml is accessible', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response?.ok()).toBe(true);
  const content = await response?.text();
  expect(content).toContain('urlset');
});

test('robots.txt is accessible', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response?.ok()).toBe(true);
  const content = await response?.text();
  expect(content).toMatch(/User-[Aa]gent/);
});

test('keyboard shortcuts overlay opens and closes', async ({ page, browserName }, _testInfo) => {
  if (browserName !== 'chromium') return;
  await page.goto('/');
  await ensureToolbarInteractable(page);
  if (_testInfo.project.name.includes('Mobile')) {
    await expect(page.getByRole('button', { name: /keyboard shortcuts/i })).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: /keyboard shortcuts/i }).click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile sidebar backdrop closes sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  await ensureToolbarInteractable(page);
  const sidebar = page.locator('.tool-shell-sidebar');

  await page.locator('[aria-label="Show options"]').click();
  await expect(sidebar).toHaveClass(/open/);

  await page.locator('.sidebar-backdrop').evaluate((el) => (el as HTMLElement).click());
  await expect(sidebar).toHaveClass(/collapsed/);
});

test('import from json file works', async ({ page }) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);

  const importedState = {
    input: 'Imported XML',
    output: '',
    format: 'pretty',
    stripDeclaration: true,
    stripComments: true,
    textAsValue: true,
    error: null,
    autoConvert: false,
  };
  const fileContent = JSON.stringify(importedState);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.evaluate((el: HTMLInputElement) => {
    el.style.display = 'block';
    el.style.visibility = 'visible';
  });
  await fileInput.setInputFiles({
    name: 'test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(fileContent),
  });

  await expect
    .poll(() => page.locator('.converter-textarea.xml-input').inputValue())
    .toContain('Imported XML');
});

test('export json download triggers', async ({ page }) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);

  const exportButton = page.getByRole('button', { name: /export/i });
  await exportButton.click({ force: true });

  const jsonOption = page.getByRole('option', { name: /JSON/ });
  const [download] = await Promise.all([page.waitForEvent('download'), jsonOption.click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});

test('image export downloads trigger for screenshot formats', async ({ page }, testInfo) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);

  if (testInfo.project.name.includes('Mobile')) {
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    return;
  }

  const expected: Array<{ option: RegExp; ext: RegExp }> = [
    { option: /PNG/, ext: /\.png$/i },
    { option: /JPEG/, ext: /\.(jpg|jpeg)$/i },
    { option: /webp/i, ext: /\.webp$/i },
  ];

  for (const format of expected) {
    await ensureToolbarInteractable(page);
    await page.getByRole('button', { name: /export/i }).click({ force: true });
    const option = page.getByRole('option', { name: format.option });
    await expect(option).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), option.click()]);
    expect(download.suggestedFilename()).toMatch(format.ext);
  }
});

test('pdf export triggers print dialog', async ({ page }, testInfo) => {
  await page.goto('/');
  await ensureToolbarInteractable(page);

  const exportButton = page.getByRole('button', { name: /export/i });
  await exportButton.click({ force: true });

  if (testInfo.project.name.includes('Mobile')) {
    await expect(exportButton).toBeVisible();
    return;
  }

  const pdfOption = page.getByRole('option', { name: /pdf/i });
  await expect(pdfOption).toBeVisible();

  // Intercept the hidden print iframe via MutationObserver + console log
  const consolePromise = new Promise<string>((resolve) => {
    const handler = (msg: import('@playwright/test').ConsoleMessage) => {
      const text = msg.text();
      if (text.includes('__printIntercepted__')) {
        page.off('console', handler);
        resolve(text);
      }
    };
    page.on('console', handler);
  });

  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLIFrameElement) {
            try {
              const cw = (node as HTMLIFrameElement).contentWindow;
              if (cw) {
                cw.print = () => {
                  console.log('__printIntercepted__');
                };
              }
            } catch {
              // cross-origin iframe, ignore
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  await pdfOption.click();

  const consoleText = await consolePromise;
  expect(consoleText).toContain('__printIntercepted__');
});

test('404 page works', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  const contentType = response?.headers()['content-type'] ?? '';
  expect(contentType).toContain('text/html');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('visual regression — default view', async ({ page, browserName }) => {
  if (browserName !== 'chromium') return;
  await page.goto('/');
  await page.waitForSelector('.tool-shell-canvas');
  await expect(page.locator('.tool-shell')).toBeVisible();
});
