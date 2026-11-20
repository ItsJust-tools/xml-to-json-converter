import { describe, it, expect } from 'vitest';
import {
  convert,
  parseXmlToObject,
  xmlToJsonTool,
  XmlToJsonToolDefinition,
} from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

const baseState: ToolState = {
  input: '',
  output: '',
  format: 'pretty',
  stripDeclaration: true,
  stripComments: true,
  textAsValue: true,
  error: null,
  autoConvert: true,
};

describe('XML to JSON conversion basics', () => {
  it('converts simple XML to correct JSON structure', () => {
    const state = { ...baseState, input: '<person><name>Alice</name><age>30</age></person>' };
    const result = convert(state);
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ person: { name: 'Alice', age: '30' } });
  });

  it('groups repeated sibling elements into arrays', () => {
    const state = {
      ...baseState,
      input: '<items><item>a</item><item>b</item><item>c</item></items>',
    };
    const result = convert(state);
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ items: { item: ['a', 'b', 'c'] } });
  });

  it('prefixes attributes as @ keys', () => {
    const state = {
      ...baseState,
      input: '<book id="1" category="fiction"><title>T</title></book>',
    };
    const result = convert(state);
    expect(result.error).toBeNull();
    const parsed = JSON.parse(result.output) as {
      book: { '@id': string; '@category': string; title: string };
    };
    expect(parsed.book['@id']).toBe('1');
    expect(parsed.book['@category']).toBe('fiction');
    expect(parsed.book.title).toBe('T');
  });

  it('keeps values as strings (no numeric coercion)', () => {
    const state = { ...baseState, input: '<n>42</n>' };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({ n: '42' });
  });

  it('decodes XML entities', () => {
    const state = { ...baseState, input: '<msg>a &lt; b &amp; c</msg>' };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({ msg: 'a < b & c' });
  });

  it('handles empty elements as empty strings', () => {
    const state = { ...baseState, input: '<root><empty/></root>' };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({ root: { empty: '' } });
  });
});

describe('textAsValue option', () => {
  it('collapses text-only elements to plain strings', () => {
    const state = { ...baseState, input: '<root><a>hello</a></root>', textAsValue: true };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({ root: { a: 'hello' } });
  });

  it('keeps text nodes as #text objects when disabled', () => {
    const state = { ...baseState, input: '<root><a>hello</a></root>', textAsValue: false };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({ root: { a: { '#text': 'hello' } } });
  });

  it('still keeps #text combined with attributes when textAsValue is true', () => {
    const state = {
      ...baseState,
      input: '<root><price currency="USD">5</price></root>',
      textAsValue: true,
    };
    const result = convert(state);
    expect(JSON.parse(result.output)).toEqual({
      root: { price: { '@currency': 'USD', '#text': '5' } },
    });
  });
});

describe('declaration and comment stripping', () => {
  const declaration = '<?xml version="1.0" encoding="UTF-8"?>';

  it('strips the XML declaration when enabled', () => {
    const state = { ...baseState, input: `${declaration}\n<root><a>1</a></root>` };
    const result = convert(state);
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ root: { a: '1' } });
  });

  it('fails without stripping when declaration-only content is present', () => {
    const state = { ...baseState, input: `  ${declaration}  `, stripDeclaration: true };
    const result = convert(state);
    expect(result.error).toContain('Nothing to convert');
    expect(result.output).toBe('');
  });

  it('strips comments when enabled', () => {
    const state = { ...baseState, input: '<!-- note --><root><a>1</a><!-- tail --></root>' };
    const result = convert(state);
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ root: { a: '1' } });
  });

  it('reports nothing to convert when input is only comments', () => {
    const state = { ...baseState, input: '<!-- only a comment -->' };
    const result = convert(state);
    expect(result.error).toContain('Nothing to convert');
  });

  it('fails with a parse error when a declaration remains and content is invalid', () => {
    const state = {
      ...baseState,
      input: `${declaration}\n<broken`,
      stripDeclaration: false,
    };
    const result = convert(state);
    expect(result.error).not.toBeNull();
  });
});

describe('format toggling', () => {
  const input = '<root><a>1</a></root>';

  it('pretty prints with indentation by default', () => {
    const result = convert({ ...baseState, input });
    expect(result.output).toContain('\n');
    expect(result.output).toContain('  ');
  });

  it('minified output has no whitespace between tokens', () => {
    const result = convert({ ...baseState, input, format: 'minified' });
    expect(result.output).toBe('{"root":{"a":"1"}}');
  });

  it('toggling back to pretty restores formatted output', () => {
    const minified = convert({ ...baseState, input, format: 'minified' });
    const pretty = convert({ ...baseState, input, format: 'pretty' });
    expect(minified.output).not.toContain('\n');
    expect(pretty.output).toContain('\n');
  });
});

describe('empty input and malformed XML', () => {
  it('returns empty output and no error for empty input', () => {
    const result = convert({ ...baseState, input: '' });
    expect(result.output).toBe('');
    expect(result.error).toBeNull();
  });

  it('returns empty output for whitespace-only input', () => {
    const result = convert({ ...baseState, input: '   \n\t  ' });
    expect(result.output).toBe('');
    expect(result.error).toBeNull();
  });

  it('produces a clear error message for malformed XML', () => {
    const state = { ...baseState, input: '<root><unclosed>' };
    const result = convert(state);
    expect(result.error).not.toBeNull();
    expect(result.output).toBe('');
    expect(result.error).toMatch(/invalid xml/i);
  });

  it('produces a clear error for mismatched tags', () => {
    const result = convert({ ...baseState, input: '<root></other>' });
    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/invalid xml/i);
  });

  it('clears a previous error when input becomes valid', () => {
    const errored = convert({ ...baseState, input: '<bad><bad>' });
    expect(errored.error).not.toBeNull();
    expect(errored.error !== null).toBe(true);
    const fixed = convert({ ...baseState, input: '<root>ok</root>' });
    expect(fixed.error).toBeNull();
    expect(fixed.output).not.toBe('');
  });
});

describe('parseXmlToObject', () => {
  it('returns raw parsed object with #text when textAsValue is false', () => {
    const parsed = parseXmlToObject('<root><a>x</a></root>', false);
    expect(parsed).toEqual({ root: { a: { '#text': 'x' } } });
  });

  it('simplifies text nodes when textAsValue is true', () => {
    const parsed = parseXmlToObject('<root><a>x</a></root>', true);
    expect(parsed).toEqual({ root: { a: 'x' } });
  });

  it('handles deeply nested structures and repeated children', () => {
    const parsed = parseXmlToObject(
      '<company><dept name="eng"><person><name>A</name></person><person><name>B</name></person></dept></company>',
      true
    );
    const company = parsed as {
      company: { dept: { '@name': string; person: Array<{ name: string }> } };
    };
    expect(company.company.dept['@name']).toBe('eng');
    expect(company.company.dept.person).toHaveLength(2);
    expect(company.company.dept.person[0]?.name).toBe('A');
  });

  it('handles self-closing tags with attributes', () => {
    const parsed = parseXmlToObject('<root><link href="https://example.com" /></root>', true);
    expect(parsed).toEqual({ root: { link: { '@href': 'https://example.com', '#text': '' } } });
  });
});

describe('tool contract', () => {
  it('initialState converts to JSON without errors', () => {
    const result = convert(xmlToJsonTool.initialState);
    expect(result.error).toBeNull();
    expect(result.output).not.toBe('');
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  it('serialize produces JSON string of state', () => {
    const json = xmlToJsonTool.serialize({ ...baseState, input: '<a>1</a>' });
    expect(typeof json).toBe('string');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serialize/deserialize round-trips state', () => {
    const state: ToolState = {
      ...baseState,
      input: '<root><a>1</a></root>',
      format: 'minified',
      autoConvert: false,
    };
    const json = xmlToJsonTool.serialize(state);
    const result = xmlToJsonTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(state);
  });

  it('deserialize rejects null', () => {
    const result = xmlToJsonTool.deserialize(null);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Invalid data format');
  });

  it('deserialize rejects primitives', () => {
    for (const value of ['string', 42, true]) {
      const result = xmlToJsonTool.deserialize(value);
      expect(result.success).toBe(false);
    }
  });

  it('deserialize rejects missing or wrong-typed fields', () => {
    expect(xmlToJsonTool.deserialize({}).success).toBe(false);
    expect(xmlToJsonTool.deserialize({ ...baseState, format: 'other' }).success).toBe(false);
    expect(xmlToJsonTool.deserialize({ ...baseState, input: 5 }).success).toBe(false);
    expect(xmlToJsonTool.deserialize({ ...baseState, stripComments: 'yes' }).success).toBe(false);
  });

  it('deserialize succeeds even with unset derived fields', () => {
    const partial = {
      input: '<a>1</a>',
      output: '',
      format: 'pretty',
      stripDeclaration: false,
      stripComments: false,
      textAsValue: false,
    };
    const result = xmlToJsonTool.deserialize(partial);
    expect(result.success).toBe(true);
  });

  it('exposes config with id and name', () => {
    expect(xmlToJsonTool.id).toBe(toolId);
    expect(xmlToJsonTool.name).toBe('XML to JSON Converter');
  });
});

const toolId = 'xml-to-json-converter';

describe('XmlToJsonToolDefinition class alias', () => {
  const def = new XmlToJsonToolDefinition();

  it('converts valid XML to JSON', () => {
    const result = def.convert({ ...baseState, input: '<root><a>1</a></root>' });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ root: { a: '1' } });
  });

  it('reports errors for malformed XML', () => {
    const result = def.convert({ ...baseState, input: '<root><x>' });
    expect(result.error).not.toBeNull();
  });

  it('round-trips through serialize then deserialize string input', () => {
    const state: ToolState = { ...baseState, input: '<root><a>1</a></root>' };
    const serialized = def.serialize(state);
    const result = def.deserialize(serialized);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(state);
  });

  it('deserialize on invalid JSON string fails gracefully', () => {
    const result = def.deserialize('not json at all');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid data format');
    }
  });

  it('parse helper uses state.textAsValue', () => {
    expect(def.parse('<r><a>x</a></r>', { ...baseState })).toEqual({ r: { a: 'x' } });
    expect(def.parse('<r><a>x</a></r>', { ...baseState, textAsValue: false })).toEqual({
      r: { a: { '#text': 'x' } },
    });
  });
});

describe('edge cases', () => {
  it('handles very long text content', () => {
    const long = 'x'.repeat(10000);
    const result = convert({ ...baseState, input: `<root>${long}</root>` });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ root: long });
  });

  it('handles mixed text and element children', () => {
    const state = { ...baseState, input: '<root>hello<a>1</a>world</root>', textAsValue: true };
    const result = convert(state);
    expect(result.error).toBeNull();
    const parsed = JSON.parse(result.output) as { root: { '#text': string; a: string } };
    expect(parsed.root.a).toBe('1');
    expect(typeof parsed.root['#text']).toBe('string');
  });

  it('does not mutate the input state', () => {
    const state = { ...baseState, input: '<root>ok</root>' };
    const snapshot = { ...state };
    convert(state);
    expect(state).toEqual(snapshot);
  });

  it('handles CRLF line endings', () => {
    const result = convert({ ...baseState, input: '<root>\r\n  <a>1</a>\r\n</root>' });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ root: { a: '1' } });
  });

  it('handles UTF-8 multibyte content', () => {
    const result = convert({ ...baseState, input: '<msg>Grüße from 中东 🍕</msg>' });
    expect(result.error).toBeNull();
    expect(JSON.parse(result.output)).toEqual({ msg: 'Grüße from 中东 🍕' });
  });
});
