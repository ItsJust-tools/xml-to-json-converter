import type { Tool, DeserializeResult } from '@itsjust/core';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import toolConfig from './tool.config';
import type { ToolState, OutputFormat } from './types';

function isToolState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.input === 'string' &&
    typeof v.output === 'string' &&
    (v.format === 'pretty' || v.format === 'minified') &&
    typeof v.stripDeclaration === 'boolean' &&
    typeof v.stripComments === 'boolean' &&
    typeof v.textAsValue === 'boolean'
  );
}

export const xmlToJsonTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: {
    input: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<bookstore>',
      '  <book id="1" category="programming">',
      '    <title>Structure and Interpretation of Computer Programs</title>',
      '    <author>Harold Abelson</author>',
      '    <year>1985</year>',
      '    <price currency="USD">64.95</price>',
      '  </book>',
      '  <book id="2" category="fiction">',
      '    <title>Norwegian Wood</title>',
      '    <author>Haruki Murakami</author>',
      '    <year>1987</year>',
      '  </book>',
      '</bookstore>',
    ].join('\n'),
    output: '',
    format: 'pretty',
    stripDeclaration: true,
    stripComments: true,
    textAsValue: true,
    error: null,
    autoConvert: true,
  },
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    try {
      if (isToolState(data)) {
        return { success: true, data: data };
      }
      return { success: false, error: 'Invalid data format: expected valid converter state' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

/** Convert XML text into an untyped XML object structure (attributes as "@" keys). */
export function parseXmlToObject(xml: string, textAsValue: boolean): unknown {
  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (validation !== true) {
    const err = validation.err;
    const location =
      err && typeof err.line === 'number' ? ` (line ${err.line}, column ${err.col})` : '';
    throw new Error(`${err?.msg ?? 'Invalid XML'}${location}`);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    attributesGroupName: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    textNodeName: '#text',
    alwaysCreateTextNode: true,
    isArray: () => false,
    processEntities: true,
  });

  const parsed = parser.parse(xml) as unknown;
  return textAsValue ? simplifyTextNodes(parsed) : parsed;
}

/** Collapse { #text: value } single-key objects down to the raw value. */
function simplifyTextNodes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(simplifyTextNodes);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === '#text' && typeof record['#text'] === 'string') {
      return record['#text'];
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = simplifyTextNodes(record[key]);
    return result;
  }
  return value;
}

function formatOutput(value: unknown, format: OutputFormat): string {
  return format === 'minified' ? JSON.stringify(value) : JSON.stringify(value, null, 2);
}

// Back-compat alias for existing tests using the class-based name.
export class XmlToJsonToolDefinition {
  initialState: ToolState = xmlToJsonTool.initialState;

  serialize(state: ToolState): string {
    return xmlToJsonTool.serialize(state);
  }

  deserialize(serialized: string): DeserializeResult<ToolState> {
    try {
      const parsed: unknown = JSON.parse(serialized);
      return xmlToJsonTool.deserialize(parsed);
    } catch {
      return { success: false, error: 'Invalid data format: expected valid converter state' };
    }
  }

  convert(state: ToolState): ToolState {
    return convert(state);
  }

  parse(input: string, state: ToolState): unknown {
    return parseXmlToObject(input, state.textAsValue);
  }
}

/** Convert XML to JSON based on state options. Not part of the Tool contract. */
export function convert(state: ToolState): ToolState {
  if (!state.input.trim()) {
    return { ...state, output: '', error: null };
  }

  try {
    let xml = state.input;

    if (state.stripComments) {
      xml = xml.replace(/<!--[\s\S]*?-->/g, '');
    }
    if (state.stripDeclaration) {
      xml = xml.replace(/^\s*<\?xml[\s\S]*?\?>\s*/g, '');
    }

    const stripped = xml.trim();
    if (!stripped) {
      return {
        ...state,
        output: '',
        error: 'Nothing to convert: XML document is empty after removing declaration/comments',
      };
    }

    const parsed = parseXmlToObject(stripped, state.textAsValue);
    return { ...state, output: formatOutput(parsed, state.format), error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...state, output: '', error: `Invalid XML: ${message}` };
  }
}

export const samplePresets: { name: string; xml: string }[] = [
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
    name: 'Config with attributes & comments',
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
    name: 'Person with nested groups',
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
      '  <address>',
      '    <street>123 Main St</street>',
      '    <city>Springfield</city>',
      '  </address>',
      '</person>',
    ].join('\n'),
  },
];
