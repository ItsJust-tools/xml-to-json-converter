'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  toolConfig,
  templateBaseVersion,
  ToolCanvas,
  ToolToolbar,
  ToolSidebar,
  xmlToJsonTool,
} from '@/tool';
import { convert } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(xmlToJsonTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );
  const state = tool.state.data;

  const title = toolConfig.name;

  useEffect(() => {
    document.title = title;
  }, [title]);

  // Live conversion: recompute output whenever relevant state changes
  useEffect(() => {
    if (!state.autoConvert) return;
    if (state.output && state.error === null && !state.input.trim()) return;
    const next = convert(state);
    if (next.output !== state.output || next.error !== state.error) {
      setToolData((prev) => {
        const converted = convert(prev);
        if (converted.output === prev.output && converted.error === prev.error) return prev;
        return converted;
      });
    }
  }, [state, setToolData]);

  const patch = useCallback(
    (updater: (prev: ToolState) => ToolState) => {
      setToolData((prev) => {
        const next = updater(prev);
        return next.autoConvert ? convert(next) : next;
      });
    },
    [setToolData]
  );

  const handleInputChange = useCallback(
    (xml: string) => {
      patch((prev) => ({ ...prev, input: xml }));
    },
    [patch]
  );

  const handleFormatChange = useCallback(
    (format: ToolState['format']) => {
      patch((prev) => ({ ...prev, format }));
    },
    [patch]
  );

  const handleOptionChange = useCallback(
    (key: 'stripDeclaration' | 'stripComments' | 'textAsValue' | 'autoConvert', value: boolean) => {
      patch((prev) => ({ ...prev, [key]: value }));
    },
    [patch]
  );

  const handlePresetSelect = useCallback(
    (xml: string) => {
      patch((prev) => ({ ...prev, input: xml }));
      showToast(`Loaded sample XML`, 'success');
    },
    [patch, showToast]
  );

  const handleClear = useCallback(() => {
    patch((prev) => ({ ...prev, input: '' }));
  }, [patch]);

  const handleReset = useCallback(() => {
    setToolData({ ...xmlToJsonTool.initialState });
    showToast('Reset to default sample', 'success');
  }, [setToolData, showToast]);

  const handleCopyOutput = useCallback(async () => {
    if (!state.output) return;
    try {
      await navigator.clipboard.writeText(state.output);
      showToast('JSON copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy JSON', 'error');
    }
  }, [state.output, showToast]);

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = xmlToJsonTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      const restored = convert(deserialized.data);
      setToolData(restored);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = xmlToJsonTool.serialize(tool.state.data);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, tool.state.data, title]);

  const toolbarContent = (
    <>
      <ToolToolbar onClear={handleClear} onCopyOutput={handleCopyOutput} onReset={handleReset} />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
    </>
  );

  const sidebarContent = (
    <ToolSidebar
      state={state}
      onFormatChange={handleFormatChange}
      onStripDeclarationChange={(v) => handleOptionChange('stripDeclaration', v)}
      onStripCommentsChange={(v) => handleOptionChange('stripComments', v)}
      onTextAsValueChange={(v) => handleOptionChange('textAsValue', v)}
      onAutoConvertChange={(v) => handleOptionChange('autoConvert', v)}
      onPresetSelect={handlePresetSelect}
    />
  );

  const canvasContent = (
    <ToolCanvas
      canvasRef={canvasRef}
      state={state}
      onInputChange={handleInputChange}
      onCopyOutput={handleCopyOutput}
    />
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-format">{state.format}</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      actions={useMemo(() => tool.toolbarActions, [tool.toolbarActions])}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
