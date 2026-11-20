export type OutputFormat = 'pretty' | 'minified';

export interface ToolState {
  /** Raw XML input from the user */
  input: string;
  /** Converted JSON output string */
  output: string;
  /** Pretty-printed or minified JSON output */
  format: OutputFormat;
  /** Strip the XML declaration (<?xml ...?>) before parsing */
  stripDeclaration: boolean;
  /** Strip XML comments (<!-- ... -->) before parsing */
  stripComments: boolean;
  /** Treat text-only elements as plain strings instead of objects */
  textAsValue: boolean;
  /** Last conversion error, if any */
  error: string | null;
  /** Live conversion as the user types */
  autoConvert: boolean;
}

export interface SamplePreset {
  name: string;
  xml: string;
}
