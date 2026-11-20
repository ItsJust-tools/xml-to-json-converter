import type { ToolConfig } from '@itsjust/core';
import packageJson from '../../package.json';

export const templateBaseVersion = packageJson.version;

const toolConfig = {
  id: 'xml-to-json-converter',
  name: 'XML to JSON Converter',
  description:
    'Convert XML documents into clean, formatted JSON with attribute handling and customizable parsing options.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#eab308',
    accentHover: '#ca8a04',
    accentSubtle: 'rgba(234, 179, 8, 0.08)',
    brand: 'XML to JSON Converter',
    icon: '\u{1F5C2}',
  },
  shortcuts: [
    {
      title: 'XML to JSON Converter',
      shortcuts: [
        { keys: 'Ctrl+Shift+E', label: 'Export All', description: 'exports all formats at once' },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
