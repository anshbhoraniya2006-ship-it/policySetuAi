import React, { useState } from 'react';
import { Table as TableIcon, Code, Copy, Check } from 'lucide-react';

interface MarkdownTableRendererProps {
  tableMarkdown: string;
  title?: string;
  className?: string;
}

export const MarkdownTableRenderer: React.FC<MarkdownTableRendererProps> = ({
  tableMarkdown,
  title,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState(false);

  // Parse Markdown table into headers and rows
  const parseTable = (markdown: string) => {
    const lines = markdown
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'));

    if (lines.length < 2) return null;

    const headers = lines[0]
      .slice(1, -1)
      .split('|')
      .map((h) => h.trim());

    // Skip separator line (line 1: |---|---|...)
    const dataRows = lines.slice(2).map((row) =>
      row
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
    );

    return { headers, rows: dataRows };
  };

  const parsed = parseTable(tableMarkdown);

  const handleCopy = () => {
    navigator.clipboard.writeText(tableMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatCellValue = (text: string) => {
    // Highlight currency amounts (e.g. ₹ 8,500, ₹17,000)
    if (/₹\s?[\d,]+/.test(text)) {
      return (
        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          {text}
        </span>
      );
    }
    // Highlight percentage slabs (e.g. 33%, 75%, 85%)
    if (/[\d.]+%/.test(text)) {
      return (
        <span className="inline-flex items-center font-mono font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {text}
        </span>
      );
    }
    // Highlight hours or hectare metrics
    if (/हेक्टर|hectare|hour|hours|दिवस|days/i.test(text)) {
      return (
        <span className="inline-flex items-center font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {text}
        </span>
      );
    }
    return <span className="text-slate-800">{text}</span>;
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden shadow-subtle ${className}`}>
      {/* Table Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-slate-800">
            {title || 'Preserved Subsidy Matrix'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
            Layout Preserved
          </span>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[11px]">
            <button
              onClick={() => setViewMode('rendered')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                viewMode === 'rendered'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'raw'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Markdown</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors ml-1"
            title="Copy Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {viewMode === 'raw' ? (
        <div className="p-3 bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed">
          <pre className="whitespace-pre-wrap">{tableMarkdown}</pre>
        </div>
      ) : parsed ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200">
                {parsed.headers.map((h, i) => (
                  <th
                    key={i}
                    className="py-2.5 px-3.5 font-bold text-slate-700 uppercase tracking-wider text-[10px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parsed.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`hover:bg-slate-50 transition-colors ${
                    rowIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                  }`}
                >
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="py-2.5 px-3.5 align-middle">
                      {formatCellValue(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap">
          {tableMarkdown}
        </div>
      )}
    </div>
  );
};

