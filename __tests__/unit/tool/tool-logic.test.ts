import { describe, it, expect } from 'vitest';
import { xmlToJsonTool } from '@/tool/tool-definition';
import { convert } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

describe('XML to JSON tool state', () => {
  it('initializes with the bookstore sample and live conversion on', () => {
    const state = xmlToJsonTool.initialState;
    expect(state.autoConvert).toBe(true);
    expect(state.format).toBe('pretty');
    expect(state.input).toContain('<bookstore>');
    expect(state.error).toBeNull();
  });

  it('initial state converts without error', () => {
    const result = convert(xmlToJsonTool.initialState);
    expect(result.error).toBeNull();
    const parsed = JSON.parse(result.output) as { bookstore: { book: unknown[] } };
    expect(Array.isArray(parsed.bookstore.book)).toBe(true);
    expect(parsed.bookstore.book).toHaveLength(2);
  });

  it('groups repeated book siblings into an array with @ attributes', () => {
    const result = convert(xmlToJsonTool.initialState);
    const parsed = JSON.parse(result.output) as {
      bookstore: { book: Array<{ '@id': string; title: string }> };
    };
    expect(parsed.bookstore.book[0]?.['@id']).toBe('1');
    expect(parsed.bookstore.book[1]?.['@id']).toBe('2');
    expect(parsed.bookstore.book[1]?.title).toBe('Norwegian Wood');
  });

  it('converts each repeated sibling element the same way', () => {
    const result = convert(xmlToJsonTool.initialState);
    const parsed = JSON.parse(result.output) as {
      bookstore: {
        book: Array<{ year: string; price?: { '@currency': string; '#text': string } }>;
      };
    };
    expect(parsed.bookstore.book[0]?.year).toBe('1985');
    expect(parsed.bookstore.book[0]?.price?.['@currency']).toBe('USD');
    expect(parsed.bookstore.book[1]?.price).toBeUndefined();
  });
});

describe('XML deserialize', () => {
  const validState: ToolState = {
    input: '<a/>',
    output: '',
    format: 'pretty',
    stripDeclaration: true,
    stripComments: true,
    textAsValue: true,
    error: null,
    autoConvert: true,
  };

  it('accepts valid state object', () => {
    const result = xmlToJsonTool.deserialize({ ...validState });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.input).toBe('<a/>');
  });

  it('rejects null data', () => {
    const result = xmlToJsonTool.deserialize(null);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Invalid data');
  });

  it('rejects non-object data', () => {
    const result = xmlToJsonTool.deserialize('string');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Invalid data');
  });

  it('rejects object with wrong format value', () => {
    const result = xmlToJsonTool.deserialize({ ...validState, format: 'compact' });
    expect(result.success).toBe(false);
  });

  it('rejects object with missing stripDeclaration', () => {
    const { stripDeclaration: _omit, ...rest } = validState;
    void _omit;
    const result = xmlToJsonTool.deserialize(rest);
    expect(result.success).toBe(false);
  });

  it('round-trips state through serialize/deserialize', () => {
    const state: ToolState = { ...validState, input: '<root>x</root>', format: 'minified' };
    const json = xmlToJsonTool.serialize(state);
    expect(() => JSON.parse(json)).not.toThrow();
    const result = xmlToJsonTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(state);
  });
});
