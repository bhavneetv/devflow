import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  ExternalLink,
  Trash2,
  FileText,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  Calendar,
  HardDrive,
  GitCommit,
  User,
  Tag,
  Save,
  Loader2,
  Lock,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument, DocumentCategory } from '../../types/document';
import { documentService } from '../../services/document.service';
import { formatDistanceToNow } from '../../lib/dateUtils';

interface DocumentDetailsDrawerProps {
  projectId: number;
  document: ProjectDocument | null;
  categories: DocumentCategory[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedDoc: ProjectDocument) => void;
  onShare: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const DocumentDetailsDrawer: React.FC<DocumentDetailsDrawerProps> = ({
  projectId,
  document: initialDoc,
  categories,
  isOpen,
  onClose,
  onUpdate,
  onShare,
  onDelete,
}) => {
  const [doc, setDoc] = useState<ProjectDocument | null>(initialDoc);
  const [activeTab, setActiveTab] = useState<'preview' | 'metadata' | 'edit' | 'shares' | 'activity'>('preview');
  const [isSaving, setIsSaving] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined);
  const [editTags, setEditTags] = useState('');

  useEffect(() => {
    setDoc(initialDoc);
    if (initialDoc) {
      setEditName(initialDoc.name);
      setEditDescription(initialDoc.description || '');
      setEditCategoryId(initialDoc.categoryId || undefined);
      setEditTags((initialDoc.tags || []).join(', '));
      setTextContent(null);

      // Check if text/code/markdown to load text preview
      const ext = initialDoc.fileExtension.toLowerCase().replace('.', '');
      const isText = ['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'env', 'sh', 'csv', 'sql'].includes(ext);

      if (isText) {
        setIsLoadingText(true);
        fetch(documentService.getContentUrl(projectId, initialDoc.id, false))
          .then((res) => res.text())
          .then((text) => {
            setTextContent(text);
            setIsLoadingText(false);
          })
          .catch(() => {
            setTextContent('Failed to load text preview');
            setIsLoadingText(false);
          });
      }

      // Fetch freshest doc details including shares and activities
      documentService.getDocument(projectId, initialDoc.id).then((res) => {
        if (res.success && res.data) {
          setDoc(res.data);
        }
      });
    }
  }, [initialDoc, projectId]);

  if (!isOpen || !doc) return null;

  const ext = doc.fileExtension.toLowerCase().replace('.', '');
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isMedia = ['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(ext);
  const isCodeOrText = ['txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'html', 'css', 'yaml', 'yml', 'env', 'sh', 'csv', 'sql'].includes(ext);
  const previewUrl = documentService.getContentUrl(projectId, doc.id, false);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await documentService.updateDocument(projectId, doc.id, {
        name: editName,
        description: editDescription,
        categoryId: editCategoryId || null,
        tags: tagsArray,
      });

      if (res.success && res.data) {
        setDoc(res.data);
        onUpdate(res.data);
        setActiveTab('metadata');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeShare = async (shareId: number) => {
    const res = await documentService.revokeShare(projectId, doc.id, shareId);
    if (res.success) {
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              shares: (prev.shares || []).filter((s) => s.id !== shareId),
            }
          : prev
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-blue-400 font-semibold border border-zinc-700">
                {ext}
              </span>
              <h3 className="text-sm font-semibold text-white tracking-tight truncate max-w-md">
                {doc.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{formatBytes(doc.sizeBytes)}</span>
              <span>•</span>
              <span>Version {doc.version}</span>
              <span>•</span>
              <span>{doc.downloadCount} downloads</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Action Bar */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => documentService.downloadDocument(projectId, doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
            <button
              onClick={() => onShare(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 transition-colors"
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Open raw content in new tab"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          <button
            onClick={() => onDelete(doc)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
            title="Delete document"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="flex items-center px-4 sm:px-5 border-b border-zinc-800 bg-zinc-900 text-xs">
          {(
            [
              { key: 'preview', label: 'Preview' },
              { key: 'metadata', label: 'Metadata' },
              { key: 'edit', label: 'Edit' },
              { key: 'shares', label: `Shares (${doc.shares?.length || 0})` },
              { key: 'activity', label: 'Audit Log' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'py-2.5 px-3 font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* 1. Preview Tab */}
          {activeTab === 'preview' && (
            <div className="h-full flex flex-col items-center justify-center min-h-[300px]">
              {isImage && (
                <div className="w-full flex items-center justify-center bg-zinc-950/80 rounded-xl p-3 border border-zinc-800 overflow-hidden">
                  <img
                    src={previewUrl}
                    alt={doc.name}
                    className="max-h-[500px] w-auto object-contain rounded-lg shadow-md"
                  />
                </div>
              )}

              {isPdf && (
                <div className="w-full h-[520px] rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                  <iframe
                    src={previewUrl}
                    title={doc.name}
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {isCodeOrText && (
                <div className="w-full h-[520px] flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                    <span>{doc.name}</span>
                    <span>{textContent ? `${textContent.split('\n').length} lines` : ''}</span>
                  </div>
                  <div className="p-4 overflow-auto flex-1 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre">
                    {isLoadingText ? (
                      <div className="flex items-center justify-center h-full gap-2 text-zinc-500">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Loading file contents from GitHub...</span>
                      </div>
                    ) : (
                      textContent || 'Empty file'
                    )}
                  </div>
                </div>
              )}

              {isMedia && (
                <div className="w-full flex flex-col items-center justify-center p-6 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  {ext.includes('mp4') || ext.includes('mov') || ext.includes('webm') ? (
                    <video controls src={previewUrl} className="max-h-[400px] rounded-lg" />
                  ) : (
                    <audio controls src={previewUrl} className="w-full max-w-md" />
                  )}
                </div>
              )}

              {!isImage && !isPdf && !isCodeOrText && !isMedia && (
                <div className="text-center space-y-4 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mx-auto">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{doc.name}</h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                      Direct browser preview is not supported for this file type. You can download the file to inspect it locally.
                    </p>
                  </div>
                  <button
                    onClick={() => documentService.downloadDocument(projectId, doc)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    <Download size={14} />
                    <span>Download {formatBytes(doc.sizeBytes)}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 divide-y divide-zinc-800/80">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">File Name</span>
                  <span className="font-semibold text-white">{doc.name}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">Category</span>
                  <span className="text-white">
                    {doc.category ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: doc.category.color || '#3b82f6' }}
                        />
                        {doc.category.name}
                      </span>
                    ) : (
                      'None'
                    )}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">File Size</span>
                  <span className="font-mono text-zinc-200">{formatBytes(doc.sizeBytes)}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">MIME Type</span>
                  <span className="font-mono text-zinc-300">{doc.mimeType}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">GitHub Storage Path</span>
                  <span className="font-mono text-blue-400 truncate max-w-xs">{doc.gitHubPath}</span>
                </div>
                {doc.gitHubSha && (
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-zinc-400">Commit SHA</span>
                    <span className="font-mono text-zinc-400">{doc.gitHubSha.slice(0, 10)}</span>
                  </div>
                )}
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">Uploaded By</span>
                  <span className="text-zinc-200">{doc.createdBy?.name || 'DevFlow Member'}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">Uploaded Date</span>
                  <span className="text-zinc-300">{new Date(doc.createdAt).toLocaleString()}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">Last Modified</span>
                  <span className="text-zinc-300">{new Date(doc.updatedAt).toLocaleString()}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-zinc-400">Total Downloads</span>
                  <span className="font-mono font-semibold text-white">{doc.downloadCount}</span>
                </div>
              </div>

              {doc.description && (
                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-1">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Description
                  </span>
                  <p className="text-zinc-300 leading-relaxed">{doc.description}</p>
                </div>
              )}

              {doc.tags && doc.tags.length > 0 && (
                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-blue-400 border border-zinc-700 font-mono text-[11px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Edit Tab */}
          {activeTab === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Category
                </label>
                <select
                  value={editCategoryId !== undefined ? String(editCategoryId) : ''}
                  onChange={(e) => setEditCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">(None)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Description / Wiki Notes
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  placeholder="Explain what this document is, architectural context, or team instructions..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="spec, v2, architecture, backend"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {/* 4. Active Shares Tab */}
          {activeTab === 'shares' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Active Share Links</span>
                <button
                  onClick={() => onShare(doc)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                >
                  <Share2 size={12} />
                  <span>New Share</span>
                </button>
              </div>

              {doc.shares && doc.shares.length > 0 ? (
                <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-xl bg-zinc-950/40">
                  {doc.shares.map((share) => (
                    <div key={share.id} className="p-3.5 flex items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase',
                              share.shareType === 'public'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            )}
                          >
                            {share.shareType}
                          </span>
                          <span className="text-zinc-200 font-medium">
                            {share.shareType === 'public'
                              ? 'External Token Link'
                              : share.sharedWithUser?.name || 'Workspace Member'}
                          </span>
                          {share.hasPassword && (
                            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                              <Lock size={10} /> Password Protected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <span>Perm: {share.permission}</span>
                          <span>•</span>
                          <span>{share.downloadCount} downloads</span>
                          {share.expiresAt && (
                            <>
                              <span>•</span>
                              <span>Expires {new Date(share.expiresAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRevokeShare(share.id)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        title="Revoke share access"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-500">
                  This document has not been shared yet. Click "New Share" to generate a secure link.
                </div>
              )}
            </div>
          )}

          {/* 5. Audit Log Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3 text-xs">
              {doc.activities && doc.activities.length > 0 ? (
                <div className="space-y-3">
                  {doc.activities.map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-950/40 border border-zinc-850">
                      <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 mt-0.5">
                        {act.user?.name ? act.user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-zinc-300">
                          <strong className="text-white font-medium">{act.user?.name || 'User'}</strong>{' '}
                          <span className="text-zinc-400">{act.action}</span>
                        </p>
                        {act.details && (
                          <p className="text-[11px] text-zinc-500 font-mono">{act.details}</p>
                        )}
                        <span className="text-[10px] text-zinc-500 block">
                          {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No activity history logged for this file yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

