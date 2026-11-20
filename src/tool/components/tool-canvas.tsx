'use client';

import { useMemo, useState } from 'react';
import type { ToolState } from '../types';

interface ToolCanvasProps {
  state: ToolState;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  onInputChange: (xml: string) => void;
  onCopyOutput: () => void;
}

export function ToolCanvas({ state, canvasRef, onInputChange, onCopyOutput }: ToolCanvasProps) {
  const [copied, setCopied] = useState(false);

  const outputText = state.output;
  const outputStats = useMemo(() => {
    const lines = outputText ? outputText.split('\n').length : 0;
    return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${outputText.length} chars`;
  }, [outputText]);

  const handleCopy = () => {
    onCopyOutput();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={canvasRef}
      className="xml-json-canvas"
      role="application"
      aria-label="XML to JSON converter canvas"
    >
      <div className="converter-panes">
        <section className="converter-pane" aria-label="XML input">
          <header className="pane-header">
            <h2>XML</h2>
            <span className="pane-meta">{state.input.length} chars</span>
          </header>
          <textarea
            className="converter-textarea xml-input"
            value={state.input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              'Paste your XML here...\n\n<person id="1">\n  <name>Hello</name>\n</person>'
            }
            aria-label="XML input"
            spellCheck={false}
          />
        </section>

        <div className="converter-divider" aria-hidden="true">
          <span>→</span>
        </div>

        <section className="converter-pane" aria-label="JSON output">
          <header className="pane-header">
            <h2>JSON</h2>
            <div className="pane-actions">
              <span className="pane-meta">{outputStats}</span>
              <button
                type="button"
                className="pane-btn"
                onClick={handleCopy}
                disabled={!state.output}
                aria-label="Copy JSON output"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </header>
          {state.error ? (
            <div className="converter-error" role="alert" aria-live="assertive">
              <strong>Invalid XML</strong>
              <pre>{state.error}</pre>
            </div>
          ) : (
            <textarea
              className="converter-textarea json-output"
              value={outputText}
              readOnly
              placeholder="JSON output appears here..."
              aria-label="JSON output"
              spellCheck={false}
            />
          )}
        </section>
      </div>
    </div>
  );
}
