import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  Download,
  Share2,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument } from '../../types/document';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { documentService } from '../../services/document.service';

interface DocumentCardViewProps {
  projectId: number;
  documents: ProjectDocument[];
  selectedDocIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectDocument: (doc: ProjectDocument) => void;
  onShareDocument: (doc: ProjectDocument) => void;
  onEditDocument: (doc: ProjectDocument) => void;
  onDeleteDocument: (doc: ProjectDocument) => void;
  density?: 'compact' | 'comfortable';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function isImageExtension(ext: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext.toLowerCase().replace('.', ''));
}

function getFileTypeMeta(ext: string) {
  const e = ext.toLowerCase().replace('.', '');
  if (isImageExtension(e)) {
    return { icon: ImageIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml'].includes(e)) {
    return { icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(e)) {
    return { icon: Archive, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
  }
  if (['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(e)) {
    return { icon: Film, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
  }
  if (e === 'pdf') {
    return { icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
  }
  return { icon: FileText, color: 'text-zinc-400', bg: 'bg-zinc-800 border-zinc-700' };
}

export const DocumentCardView: React.FC<DocumentCardViewProps> = ({
  projectId,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectDocument,
  onShareDocument,
  onEditDocument,
  onDeleteDocument,
  density = 'comfortable',
}) => {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  if (documents.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
        No documents match your current filter criteria.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-3.5',
        density === 'compact'
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4'
      )}
    >
      {documents.map((doc) => {
        const isSelected = selectedDocIds.includes(doc.id);
        const meta = getFileTypeMeta(doc.fileExtension);
        const Icon = meta.icon;
        const isImg = isImageExtension(doc.fileExtension);
        const previewUrl = documentService.getContentUrl(projectId, doc.id, false);

        return (
          <div
            key={doc.id}
            className={cn(
              'group relative rounded-xl border bg-zinc-900/80 transition-all duration-200 flex flex-col justify-between overflow-hidden hover:shadow-lg',
              isSelected
                ? 'border-blue-500 bg-blue-950/20 shadow-blue-950/40'
                : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-850'
            )}
          >
            {/* Top selection checkbox & badge */}
            <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(doc.id);
                }}
                className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center transition-all',
                  isSelected
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-900/80 border-zinc-700/80 text-transparent opacity-0 group-hover:opacity-100 hover:border-zinc-500'
                )}
              >
                <Check size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} />
              </button>
            </div>

            {/* Menu trigger top right */}
            <div className="absolute top-2.5 right-2.5 z-20">
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                  }}
                  className="p-1 rounded-md text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Dropdown menu */}
                {activeMenuId === doc.id && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                      }}
                    />
                    <div className="absolute right-0 top-7 z-40 w-44 rounded-lg bg-zinc-900 border border-zinc-800 shadow-xl py-1 text-xs">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                          onSelectDocument(doc);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <Eye size={13} />
                        <span>Preview & Details</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                          documentService.downloadDocument(projectId, doc);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(null);
                          onShareDocument(doc);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      >
                        <Share2 size={13} />
                        <span>Share Document</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
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

            {/* Thumbnail Preview Area */}
            <div
              onClick={() => onSelectDocument(doc)}
              className={cn(
                'relative w-full cursor-pointer flex items-center justify-center bg-zinc-950/60 border-b border-zinc-800/60 overflow-hidden',
                density === 'compact' ? 'h-24' : 'h-36'
              )}
            >
              {isImg ? (
                <img
                  src={previewUrl}
                  alt={doc.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to icon if thumbnail fails to render
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  <div className={cn('p-3 rounded-xl border', meta.bg, meta.color)}>
                    <Icon size={28} />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    {doc.fileExtension.replace('.', '')}
                  </span>
                </div>
              )}

              {/* Hover quick overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDocument(doc);
                  }}
                  title="Preview"
                  className="p-2 rounded-lg bg-zinc-900/90 text-white hover:bg-blue-600 transition-colors shadow-md"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    documentService.downloadDocument(projectId, doc);
                  }}
                  title="Download"
                  className="p-2 rounded-lg bg-zinc-900/90 text-white hover:bg-emerald-600 transition-colors shadow-md"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareDocument(doc);
                  }}
                  title="Share"
                  className="p-2 rounded-lg bg-zinc-900/90 text-white hover:bg-indigo-600 transition-colors shadow-md"
                >
                  <Share2 size={14} />
                </button>
              </div>
            </div>

            {/* Document Details Footer */}
            <div
              onClick={() => onSelectDocument(doc)}
              className="p-3.5 space-y-2 cursor-pointer flex-1 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <h4
                    className="text-xs font-semibold text-zinc-200 group-hover:text-white line-clamp-1 break-all"
                    title={doc.name}
                  >
                    {doc.name}
                  </h4>
                </div>

                {doc.category && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: doc.category.color || '#3b82f6' }}
                    />
                    <span className="text-[11px] text-zinc-400 truncate">
                      {doc.category.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                <span>{formatBytes(doc.sizeBytes)}</span>
                <span title={`Updated: ${new Date(doc.updatedAt).toLocaleString()}`}>
                  {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

