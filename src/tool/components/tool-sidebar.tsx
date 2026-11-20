'use client';

import type { ToolState } from '../types';

interface ToolSidebarProps {
  state: ToolState;
  onFormatChange: (format: ToolState['format']) => void;
  onStripDeclarationChange: (value: boolean) => void;
  onStripCommentsChange: (value: boolean) => void;
  onTextAsValueChange: (value: boolean) => void;
  onAutoConvertChange: (value: boolean) => void;
  onPresetSelect: (xml: string) => void;
}

const CHECKBOXES: Array<{
  key: 'stripDeclaration' | 'stripComments' | 'textAsValue' | 'autoConvert';
  label: string;
  title: string;
}> = [
  {
    key: 'stripDeclaration',
    label: 'Strip XML declaration',
    title: 'Remove <?xml ...?> prolog before parsing',
  },
  {
    key: 'stripComments',
    label: 'Strip comments',
    title: 'Remove <!-- ... --> comments before parsing',
  },
  {
    key: 'textAsValue',
    label: 'Text elements as plain values',
    title: 'Elements with only text become plain JSON strings',
  },
  {
    key: 'autoConvert',
    label: 'Live conversion',
    title: 'Convert automatically while typing',
  },
];

export function ToolSidebar({
  state,
  onFormatChange,
  onStripDeclarationChange,
  onStripCommentsChange,
  onTextAsValueChange,
  onAutoConvertChange,
  onPresetSelect,
}: ToolSidebarProps) {
  const handlers: Record<string, (value: boolean) => void> = {
    stripDeclaration: onStripDeclarationChange,
    stripComments: onStripCommentsChange,
    textAsValue: onTextAsValueChange,
    autoConvert: onAutoConvertChange,
  };

  return (
    <div className="xml-json-sidebar">
      <div className="sidebar-section">
        <h3>Output Format</h3>
        <div className="format-toggle" role="group" aria-label="Output format">
          <button
            type="button"
            className={`toggle-btn ${state.format === 'pretty' ? 'active' : ''}`}
            onClick={() => onFormatChange('pretty')}
            aria-pressed={state.format === 'pretty'}
          >
            Pretty
          </button>
          <button
            type="button"
            className={`toggle-btn ${state.format === 'minified' ? 'active' : ''}`}
            onClick={() => onFormatChange('minified')}
            aria-pressed={state.format === 'minified'}
          >
            Minified
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h3>Parsing Options</h3>
        <ul className="options-list">
          {CHECKBOXES.map(({ key, label, title }) => (
            <li key={key} className="option-row">
              <label title={title}>
                <input
                  type="checkbox"
                  checked={state[key]}
                  onChange={(e) => handlers[key]?.(e.target.checked)}
                  aria-label={label}
                />
                <span>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section">
        <h3>Sample XML</h3>
        <ul className="presets-list">
          {PRESETS.map((preset) => (
            <li key={preset.name}>
              <button
                type="button"
                className="preset-btn"
                onClick={() => onPresetSelect(preset.xml)}
                aria-label={`Load sample XML: ${preset.name}`}
              >
                {preset.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface PresetItem {
  name: string;
  xml: string;
}

const PRESETS: PresetItem[] = [
  {
    name: 'Bookstore',
    xml: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<bookstore>',
      '  <book id="1" category="programming">',
      '    <title>Structure and Interpretation of Computer Programs</title>',
      '    <price currency="USD">64.95</price>',
      '  </book>',
      '</bookstore>',
    ].join('\n'),
  },
  {
    name: 'RSS feed',
    xml: [
      '<rss version="2.0">',
      '  <channel>',
      '    <title>Example Blog</title>',
      '    <item>',
      '      <title>First post</title>',
      '      <link>https://example.com/1</link>',
      '    </item>',
      '    <item>',
      '      <title>Second post</title>',
      '      <link>https://example.com/2</link>',
      '    </item>',
      '  </channel>',
      '</rss>',
    ].join('\n'),
  },
  {
    name: 'Config with comments',
    xml: [
      '<!-- application settings -->',
      '<?xml version="1.0"?>',
      '<config version="2" debug="false" environment="production">',
      '  <server host="0.0.0.0" port="8080" />',
      '  <feature name="dark-mode" enabled="true" />',
      '</config>',
    ].join('\n'),
  },
  {
    name: 'Person with skills',
    xml: [
      '<person>',
      '  <name>Alice</name>',
      '  <age>30</age>',
      '  <active>true</active>',
      '  <skills>',
      '    <skill>JavaScript</skill>',
      '    <skill>TypeScript</skill>',
      '    <skill>Node.js</skill>',
      '  </skills>',
      '</person>',
    ].join('\n'),
  },
];
