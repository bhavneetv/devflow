import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  Download,
  Share2,
  Trash2,
  Edit,
  Eye,
  Check,
  MoreHorizontal,
  Folder,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument, DocumentCategory } from '../../types/document';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { documentService } from '../../services/document.service';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentListViewProps {
  projectId: number;
  documents: ProjectDocument[];
  categories: DocumentCategory[];
  selectedDocIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectDocument: (doc: ProjectDocument) => void;
  onShareDocument: (doc: ProjectDocument) => void;
  onEditDocument: (doc: ProjectDocument) => void;
  onDeleteDocument: (doc: ProjectDocument) => void;
  onBulkDelete: () => void;
  onBulkMoveCategory: (categoryId: number | null) => void;
  density?: 'compact' | 'comfortable';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(ext: string) {
  const e = ext.toLowerCase().replace('.', '');
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(e)) return ImageIcon;
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml'].includes(e)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(e)) return Archive;
  if (['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(e)) return Film;
  return FileText;
}

export const DocumentListView: React.FC<DocumentListViewProps> = ({
  projectId,
  documents,
  categories,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onSelectDocument,
  onShareDocument,
  onEditDocument,
  onDeleteDocument,
  onBulkDelete,
  onBulkMoveCategory,
  density = 'comfortable',
}) => {
  const { accentColor } = useAccentTheme();
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const allSelected = documents.length > 0 && selectedDocIds.length === documents.length;
  const hasSelection = selectedDocIds.length > 0;

  const handleBulkDownload = async () => {
    const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));
    for (const doc of selectedDocs) {
      await documentService.downloadDocument(projectId, doc);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
        No documents match your current filter criteria.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ─── Bulk Action Bar (when items selected) ─────────────────────────── */}
      {hasSelection && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border text-xs"
          style={{
            backgroundColor: `${accentColor}15`,
            borderColor: `${accentColor}40`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ color: accentColor }}>
              {selectedDocIds.length} {selectedDocIds.length === 1 ? 'file' : 'files'} selected
            </span>
            <button
              onClick={onClearSelection}
              className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0A0B10] transition-all shadow-sm hover:brightness-110 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Download size={13} />
              <span>Download Selected</span>
            </button>

            {/* Move to Folder (AnimatedSelect) */}
            <div className="w-44">
              <AnimatedSelect
                value="__move_prompt__"
                onChange={(val) => onBulkMoveCategory(val ? Number(val) : null)}
                placeholder="Move to Folder..."
                searchPlaceholder="Search folder..."
                accentColor={accentColor}
                dropdownAlign="right"
                dropdownMinWidth="w-52"
                options={[
                  {
                    value: '',
                    label: 'Root (No Folder)',
                    icon: <Folder size={13} className="text-zinc-400" />,
                  },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                    icon: (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color || '#3b82f6' }}
                      />
                    ),
                    sublabel: `${c._count?.documents || 0} files`,
                  })),
                ]}
              />
            </div>

            <button
              onClick={onBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Table View ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 font-medium">
              <th className="py-3 px-3 w-10 text-center">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto',
                    allSelected
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-zinc-700 hover:border-zinc-500'
                  )}
                >
                  <Check size={11} className={allSelected ? 'opacity-100' : 'opacity-0'} />
                </button>
              </th>
              <th className="py-3 px-3">Name</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Size</th>
              <th className="py-3 px-3">Uploader</th>
              <th className="py-3 px-3">Last Modified</th>
              <th className="py-3 px-3 text-center">Downloads</th>
              <th className="py-3 px-3 text-right w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {documents.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.id);
              const Icon = getFileIcon(doc.fileExtension);

              return (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-blue-950/20 hover:bg-blue-950/30'
                      : 'hover:bg-zinc-800/40',
                    density === 'compact' ? 'py-1.5' : 'py-3'
                  )}
                >
                  {/* Checkbox column */}
                  <td
                    className="py-2.5 px-3 text-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(doc.id);
                    }}
                  >
                    <button
                      type="button"
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto',
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-zinc-700/80 hover:border-zinc-500'
                      )}
                    >
                      <Check size={11} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </button>
                  </td>

                  {/* Name & Icon */}
                  <td className="py-2.5 px-3 min-w-[200px] max-w-[340px]">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors shrink-0">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-zinc-200 group-hover:text-white truncate block">
                          {doc.name}
                        </span>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {doc.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {doc.category ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md font-medium"
                        style={{
                          backgroundColor: `${doc.category.color || '#3b82f6'}15`,
                          color: doc.category.color || '#60a5fa',
                          border: `1px solid ${doc.category.color || '#3b82f6'}30`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: doc.category.color || '#3b82f6' }}
                        />
                        {doc.category.name}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Size */}
                  <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                    {formatBytes(doc.sizeBytes)}
                  </td>

                  {/* Uploader */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                        {doc.createdBy?.name ? doc.createdBy.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <span className="text-zinc-300 text-xs">
                        {doc.createdBy?.name || 'DevFlow Member'}
                      </span>
                    </div>
                  </td>

                  {/* Last Modified */}
                  <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap text-[11px]">
                    {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </td>

                  {/* Downloads count */}
                  <td className="py-2.5 px-3 text-center text-zinc-400 font-mono text-[11px]">
                    {doc.downloadCount}
                  </td>

                  {/* Actions Column */}
                  <td
                    className="py-2.5 px-3 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSelectDocument(doc)}
                        title="Preview"
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => documentService.downloadDocument(projectId, doc)}
                        title="Download"
                        className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => onShareDocument(doc)}
                        title="Share"
                        className="p-1 rounded text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Share2 size={13} />
                      </button>

                      {/* Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === doc.id ? null : doc.id)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {activeMenuId === doc.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setActiveMenuId(null)}
                            />
                            <div className="absolute right-0 top-6 z-40 w-40 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl py-1 text-xs">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onEditDocument(doc);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800"
                              >
                                <Edit size={13} />
                                <span>Edit Details</span>
                              </button>
                              <div className="my-1 border-t border-zinc-800" />
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onDeleteDocument(doc);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                              >
                                <Trash2 size={13} />
                                <span>Delete File</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

