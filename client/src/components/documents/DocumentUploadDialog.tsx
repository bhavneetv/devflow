import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  File,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Edit3,
  Check,
  Folder,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentCategory } from '../../types/document';
import { documentService } from '../../services/document.service';
import { AnimatedSelect, SelectOption } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';

interface DocumentUploadDialogProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
  initialCategoryId?: number | null;
  onUploadSuccess: () => void;
}

interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  isEditingName?: boolean;
}

const MAX_FILE_SIZE_BYTES = 26214400; // 25 MB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(name: string) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return ImageIcon;
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css'].includes(ext)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return Archive;
  if (['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(ext)) return Film;
  return FileText;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export const DocumentUploadDialog: React.FC<DocumentUploadDialogProps> = ({
  projectId,
  isOpen,
  onClose,
  categories,
  initialCategoryId,
  onUploadSuccess,
}) => {
  const { accentColor } = useAccentTheme();
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState<{ [id: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialCategoryId whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCategoryId !== undefined) {
        setTargetFolderId(initialCategoryId);
      } else if (categories.length > 0) {
        setTargetFolderId(categories[0].id);
      } else {
        setTargetFolderId(null);
      }
    }
  }, [isOpen, initialCategoryId, categories]);

  if (!isOpen) return null;

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;

    const newItems: QueuedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isTooBig = f.size > MAX_FILE_SIZE_BYTES;
      newItems.push({
        id: `${f.name}-${Date.now()}-${i}`,
        file: f,
        name: f.name,
        size: f.size,
        mimeType: f.type || 'application/octet-stream',
        status: isTooBig ? 'error' : 'pending',
        errorMessage: isTooBig ? `Exceeds max 25 MB limit (${formatBytes(f.size)})` : undefined,
      });
    }

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  // Queue actions: Delete & Edit (rename)
  const handleRemove = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStartRename = (item: QueuedFile) => {
    setEditingNameValue((prev) => ({ ...prev, [item.id]: item.name }));
    setQueue((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isEditingName: true } : i))
    );
  };

  const handleSaveRename = (id: string) => {
    const newName = (editingNameValue[id] || '').trim();
    if (newName) {
      setQueue((prev) =>
        prev.map((i) => (i.id === id ? { ...i, name: newName, isEditingName: false } : i))
      );
    } else {
      setQueue((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isEditingName: false } : i))
      );
    }
  };

  const handleCancelRename = (id: string) => {
    setQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isEditingName: false } : i))
    );
  };

  // Perform upload
  const startUpload = async () => {
    const validFiles = queue.filter((i) => i.status === 'pending' || i.status === 'error');
    if (validFiles.length === 0) return;

    setIsUploading(true);

    try {
      setQueue((prev) =>
        prev.map((item) =>
          item.status === 'pending' ? { ...item, status: 'uploading' } : item
        )
      );

      const filesPayload: Array<{
        name: string;
        contentBase64: string;
        base64?: string;
        mimeType: string;
        size: number;
        sizeBytes?: number;
        categoryId?: number | null;
      }> = [];

      for (const item of validFiles) {
        const base64 = await readFileAsBase64(item.file);
        filesPayload.push({
          name: item.name,
          contentBase64: base64,
          base64: base64,
          mimeType: item.mimeType,
          size: item.size,
          sizeBytes: item.size,
          categoryId: targetFolderId,
        });
      }

      const res = await documentService.uploadDocuments(
        projectId,
        filesPayload,
        'rename'
      );

      if (res.data) {
        const succeededNames = new Set(
          res.data.uploaded.map((u: any) => u.name || u.displayName || u.originalName)
        );
        const errorMap = new Map(
          res.data.errors.map((e: any) => [e.fileName, e.reason || e.error || 'Upload failed'])
        );

        setQueue((prev) =>
          prev.map((item) => {
            if (succeededNames.has(item.name)) {
              return { ...item, status: 'completed' };
            }
            if (errorMap.has(item.name)) {
              return {
                ...item,
                status: 'error',
                errorMessage: errorMap.get(item.name),
              };
            }
            return item;
          })
        );

        if (res.data.uploaded.length > 0) {
          onUploadSuccess();
        }

        if (res.data.errors.length === 0 && res.data.uploaded.length > 0) {
          setTimeout(() => {
            onClose();
            setQueue([]);
          }, 800);
        }
      } else {
        setQueue((prev) =>
          prev.map((item) =>
            item.status === 'uploading'
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: res.error || 'Upload failed',
                }
              : item
          )
        );
      }
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((item) =>
          item.status === 'uploading'
            ? { ...item, status: 'error', errorMessage: err.message || 'Upload error' }
            : item
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#17181D] border border-[#27272A] rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-visible">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#27272A] flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${accentColor}20`,
                borderColor: `${accentColor}45`,
                color: accentColor,
              }}
            >
              <Upload size={16} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white tracking-tight">
                Upload File
              </h3>
              <p className="text-[11px] text-zinc-500">
                Files are committed directly to your private GitHub repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-visible">
          {/* Option: Where to put that file (Folder / Category selector) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block flex items-center gap-1.5">
              <Folder size={12} style={{ color: accentColor }} />
              <span>Where to put file (Folder)</span>
            </label>
            <AnimatedSelect
              value={targetFolderId !== null ? String(targetFolderId) : ''}
              onChange={(val) => setTargetFolderId(val ? Number(val) : null)}
              options={[
                {
                  value: '',
                  label: 'Root / General Files (No Folder)',
                  icon: <Folder size={14} className="text-zinc-400" />,
                  sublabel: 'Root level',
                },
                ...categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  icon: (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#3B82F6' }}
                    />
                  ),
                  sublabel: `${c._count?.documents || 0} files`,
                })),
              ]}
              accentColor={accentColor}
              placeholder="Choose destination folder..."
              searchPlaceholder="Search folder..."
            />
          </div>

          {/* Upload Dragger */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2',
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-[#27272A] hover:border-zinc-600 bg-[#0E0F14]/70 hover:bg-[#0E0F14]'
            )}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <Upload size={18} style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-xs font-medium text-white">
                Drag and drop files here, or <span className="underline" style={{ color: accentColor }}>browse</span>
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                PDF, Word, Images, Code, Videos, Archives (up to 25 MB each)
              </p>
            </div>
          </div>

          {/* Upload List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                <span>Upload List ({queue.length})</span>
                {completedCount > 0 && (
                  <span className="text-emerald-400 font-sans normal-case text-xs">
                    {completedCount} completed
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item) => {
                  const Icon = getFileIcon(item.name);
                  const isEditing = Boolean(item.isEditingName);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs transition-colors',
                        item.status === 'completed' && 'bg-emerald-500/5 border-emerald-500/25',
                        item.status === 'error' && 'bg-red-500/5 border-red-500/25',
                        item.status === 'uploading' && 'bg-blue-500/5 border-blue-500/25',
                        item.status === 'pending' && 'bg-[#0E0F14] border-[#27272A]'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                          <Icon size={14} />
                        </div>

                        {/* Name or Rename Input */}
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingNameValue[item.id] || ''}
                                onChange={(e) =>
                                  setEditingNameValue({
                                    ...editingNameValue,
                                    [item.id]: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(item.id);
                                  if (e.key === 'Escape') handleCancelRename(item.id);
                                }}
                                autoFocus
                                className="w-full bg-[#17181D] border border-blue-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(item.id)}
                                title="Save name"
                                className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelRename(item.id)}
                                title="Cancel"
                                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-200 truncate block">
                                  {item.name}
                                </span>
                                {item.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename(item)}
                                    title="Rename file before uploading"
                                    className="p-1 text-zinc-500 hover:text-blue-400 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                                <span>{formatBytes(item.size)}</span>
                                {item.errorMessage && (
                                  <span className="text-red-400 font-medium">
                                    • {item.errorMessage}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status / Delete Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'uploading' && (
                          <Loader2 size={14} className="animate-spin text-blue-400" />
                        )}
                        {item.status === 'completed' && (
                          <CheckCircle2 size={15} className="text-emerald-400" />
                        )}
                        {item.status === 'error' && (
                          <AlertCircle size={15} className="text-red-400" />
                        )}

                        {item.status !== 'uploading' && (
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            title="Remove file"
                            className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#27272A] flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {queue.length > 0
              ? `${pendingCount} files ready to commit`
              : 'Add files to start uploading'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={startUpload}
              disabled={isUploading || pendingCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all shadow-sm disabled:opacity-50 cursor-pointer hover:brightness-110"
              style={{ backgroundColor: accentColor }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Uploading to GitHub...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>Upload {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
