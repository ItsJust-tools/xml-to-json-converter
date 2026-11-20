'use client';

import Link from 'next/link';

interface ToolToolbarProps {
  onClear: () => void;
  onCopyOutput: () => void;
  onReset: () => void;
}

export function ToolToolbar({ onClear, onCopyOutput, onReset }: ToolToolbarProps) {
  return (
    <div className="xml-json-toolbar">
      <button type="button" className="toolbar-btn" onClick={onClear} aria-label="Clear XML input">
        Clear
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={onCopyOutput}
        aria-label="Copy JSON to clipboard"
      >
        Copy JSON
      </button>
      <button
        type="button"
        className="toolbar-btn"
        onClick={onReset}
        aria-label="Reset to sample XML and defaults"
      >
        Reset
      </button>
      <Link href="/help" className="toolbar-btn toolbar-help-link" aria-label="Open help page">
        Help
      </Link>
    </div>
  );
}
