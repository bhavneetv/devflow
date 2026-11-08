import React, { useState, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Table as TableIcon,
  Paperclip,
  Image as ImageIcon,
  Code,
  Eye,
  Edit2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export const RichTextViewer: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
}) => {
  if (!content || !content.trim()) {
    return <span className="text-zinc-500 italic">No description provided.</span>;
  }

  // Parse markdown-like syntax safely into structured elements
  const renderFormattedContent = (text: string) => {
    // If raw HTML is provided (like <h3> or <p>), sanitize basic tags
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';
    let listItems: string[] = [];

    const flushTable = (key: string) => {
      if (tableRows.length === 0) return;
      const header = tableRows[0];
      const rows = tableRows.slice(1).filter((r) => !r.every((c) => /^:?-+:?$/.test(c.trim())));
      elements.push(
        <div key={key} className="overflow-x-auto my-3">
          <table className="w-full text-left text-xs border-collapse border border-zinc-700/80 rounded-lg overflow-hidden">
            <thead className="bg-zinc-800/80 text-zinc-200">
              <tr>
                {header.map((col, idx) => (
                  <th key={idx} className="border border-zinc-700/80 px-3 py-2 font-semibold">
                    {parseInline(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-zinc-700/80 px-3 py-1.5 text-zinc-300">
                      {parseInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    const flushList = (key: string) => {
      if (listItems.length === 0) return;
      if (listType === 'ul') {
        elements.push(
          <ul key={key} className="list-disc list-inside space-y-1 my-2 text-zinc-300 text-xs">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={key} className="list-decimal list-inside space-y-1 my-2 text-zinc-300 text-xs">
            {listItems.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ol>
        );
      }
      listItems = [];
      inList = false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Check table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (!inTable) {
          if (inList) flushList(`list-before-table-${index}`);
          inTable = true;
          tableRows = [];
        }
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable(`table-${index}`);
      }

      // Check bullet list
      if (/^[-*]\s+/.test(trimmed)) {
        if (inList && listType !== 'ul') flushList(`list-switch-${index}`);
        inList = true;
        listType = 'ul';
        listItems.push(trimmed.replace(/^[-*]\s+/, ''));
        return;
      }

      // Check numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        if (inList && listType !== 'ol') flushList(`list-switch-${index}`);
        inList = true;
        listType = 'ol';
        listItems.push(trimmed.replace(/^\d+\.\s+/, ''));
        return;
      }

      if (inList) {
        flushList(`list-${index}`);
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${index}`} className="text-base font-bold text-white mt-3 mb-1">
            {parseInline(trimmed.slice(2))}
          </h1>
        );
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${index}`} className="text-sm font-bold text-zinc-100 mt-2.5 mb-1">
            {parseInline(trimmed.slice(3))}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${index}`} className="text-xs font-semibold text-zinc-200 mt-2 mb-0.5">
            {parseInline(trimmed.slice(4))}
          </h3>
        );
        return;
      }

      // Empty line / paragraph
      if (!trimmed) {
        elements.push(<div key={`blank-${index}`} className="h-2" />);
        return;
      }

      elements.push(
        <p key={`p-${index}`} className="text-xs text-zinc-300 leading-relaxed my-1">
          {parseInline(trimmed)}
        </p>
      );
    });

    if (inTable) flushTable('table-end');
    if (inList) flushList('list-end');

    return elements;
  };

  const parseInline = (text: string): React.ReactNode => {
    // Replace image / attachment markdown ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    // Replace link markdown [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    // Replace bold **text**
    const boldRegex = /\*\*([^*]+)\*\*/g;
    // Replace italic *text*
    const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g;
    // Replace code `text`
    const codeRegex = /`([^`]+)`/g;

    // Check if image match exists
    if (imgRegex.test(text)) {
      const parts = text.split(/(!\[[^\]]*\]\([^)]+\))/g);
      return parts.map((part, i) => {
        const m = /!\[([^\]]*)\]\(([^)]+)\)/.exec(part);
        if (m) {
          const alt = m[1];
          const src = m[2];
          return (
            <div key={i} className="my-2 rounded-lg overflow-hidden border border-zinc-800 inline-block max-w-full">
              <img src={src} alt={alt || 'attachment'} className="max-h-64 object-contain rounded" />
              {alt && <div className="text-[10px] text-zinc-500 px-2 py-0.5 bg-zinc-900">{alt}</div>}
            </div>
          );
        }
        return <span key={i}>{parseInline(part)}</span>;
      });
    }

    // Process links
    if (linkRegex.test(text)) {
      const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
      return parts.map((part, i) => {
        const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(part);
        if (m) {
          const linkLabel = m[1];
          const url = m[2];
          const safeUrl = url.startsWith('http') || url.startsWith('/') || url.startsWith('data:') ? url : `https://${url}`;
          return (
            <a
              key={i}
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {linkLabel}
            </a>
          );
        }
        return <span key={i}>{parseInline(part)}</span>;
      });
    }

    // Process bold
    if (boldRegex.test(text)) {
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, i) => {
        const m = /^\*\*([^*]+)\*\*$/.exec(part);
        if (m) return <strong key={i} className="font-semibold text-white">{m[1]}</strong>;
        return <span key={i}>{parseInline(part)}</span>;
      });
    }

    // Process italic
    if (italicRegex.test(text)) {
      const parts = text.split(/((?<!\*)\*[^*]+\*(?!\*))/g);
      return parts.map((part, i) => {
        const m = /^\*([^*]+)\*$/.exec(part);
        if (m) return <em key={i} className="italic text-zinc-200">{m[1]}</em>;
        return <span key={i}>{part}</span>;
      });
    }

    // Process inline code
    if (codeRegex.test(text)) {
      const parts = text.split(/(`[^`]+`)/g);
      return parts.map((part, i) => {
        const m = /^`([^`]+)`$/.exec(part);
        if (m) return <code key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-blue-300 text-[11px] font-mono">{m[1]}</code>;
        return <span key={i}>{part}</span>;
      });
    }

    return text;
  };

  return <div className={`rich-text-content space-y-1 ${className}`}>{renderFormattedContent(content)}</div>;
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Describe user stories, functional flows, and architectural constraints...',
  rows = 7,
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertText = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || defaultText;
    const replacement = `${before}${selected}${after}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const isImg = file.type.startsWith('image/');
      const tag = isImg
        ? `\n![${file.name}](${result})\n`
        : `\n[attachment: ${file.name}](${result})\n`;
      insertText(tag);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0E0E10] overflow-hidden focus-within:border-blue-500/80 transition-colors">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-2 py-1.5 gap-1 flex-wrap text-zinc-400">
        <div className="flex items-center gap-0.5 flex-wrap">
          <button
            type="button"
            title="Heading 1"
            onClick={() => insertText('# ', '', 'Heading 1')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors text-xs font-semibold"
          >
            <Heading1 size={14} />
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() => insertText('## ', '', 'Heading 2')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors text-xs font-semibold"
          >
            <Heading2 size={14} />
          </button>
          <button
            type="button"
            title="Heading 3"
            onClick={() => insertText('### ', '', 'Heading 3')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors text-xs font-semibold"
          >
            <Heading3 size={14} />
          </button>

          <span className="w-[1px] h-4 bg-zinc-800 mx-1" />

          <button
            type="button"
            title="Bold (**text**)"
            onClick={() => insertText('**', '**', 'bold text')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            title="Italic (*text*)"
            onClick={() => insertText('*', '*', 'italic text')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            title="Code (`code`)"
            onClick={() => insertText('`', '`', 'code')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Code size={14} />
          </button>

          <span className="w-[1px] h-4 bg-zinc-800 mx-1" />

          <button
            type="button"
            title="Bullet List (- item)"
            onClick={() => insertText('\n- ', '', 'List item')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            title="Numbered List (1. item)"
            onClick={() => insertText('\n1. ', '', 'Numbered item')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <ListOrdered size={14} />
          </button>

          <span className="w-[1px] h-4 bg-zinc-800 mx-1" />

          <button
            type="button"
            title="Link ([title](url))"
            onClick={() => insertText('[', '](https://example.com)', 'Link Title')}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            title="Insert Table"
            onClick={() =>
              insertText(
                '\n| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Data 1 | Data 2 | Data 3 |\n'
              )
            }
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          >
            <TableIcon size={14} />
          </button>

          <button
            type="button"
            title="Attach file / image"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:text-white hover:bg-zinc-800 rounded transition-colors flex items-center gap-1 text-[11px]"
          >
            <Paperclip size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.txt,.json,.md"
            onChange={handleFileUpload}
          />
        </div>

        {/* Write / Preview Tab toggle */}
        <div className="flex items-center gap-1 bg-zinc-800/80 p-0.5 rounded-md text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded ${
              activeTab === 'write' ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Edit2 size={11} /> Write
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded ${
              activeTab === 'preview' ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye size={11} /> Preview
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {activeTab === 'write' ? (
        <textarea
          ref={textareaRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full p-3 text-xs bg-transparent text-white placeholder-zinc-500 focus:outline-none font-mono resize-y"
        />
      ) : (
        <div className="p-3 min-h-[140px] max-h-[360px] overflow-y-auto bg-zinc-950/40">
          <RichTextViewer content={value} />
        </div>
      )}
    </div>
  );
};

