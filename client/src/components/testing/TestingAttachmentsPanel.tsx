import React, { useRef, useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Link2, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { testingService } from '../../services/testing.service';
import { documentService } from '../../services/document.service';
import { AnimatedSelect, type SelectOption } from '../settings/AnimatedSelect';
import { useToast } from '../../context/ToastContext';
import { confirmDeleteSwal } from '../../lib/confirmAlert';
import type { TestingAttachmentDocument, TestingMetaData } from '../../types/testing';
import { formatBytes, formatTestingDateTime } from './testingBadges';

interface TestingAttachmentsPanelProps {
  projectId: number;
  entityType: 'test_case' | 'execution' | 'defect';
  entityId: number;
  attachments: TestingAttachmentDocument[];
  availableDocuments?: TestingMetaData['projectDocuments'];
  canEdit: boolean;
  onUpdated: () => void;
  title?: string;
}

function readFileAsBase64(file: File): Promise<{
  name: string;
  mimeType: string;
  base64: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
      resolve({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

export const TestingAttachmentsPanel: React.FC<TestingAttachmentsPanelProps> = ({
  projectId,
  entityType,
  entityId,
  attachments,
  availableDocuments = [],
  canEdit,
  onUpdated,
  title = 'Attachments & Evidence',
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkingDocId, setLinkingDocId] = useState('');
  const [previewModalAtt, setPreviewModalAtt] = useState<TestingAttachmentDocument | null>(null);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const files = await Promise.all(Array.from(fileList).map(readFileAsBase64));
      const res = await testingService.uploadAttachments(projectId, {
        entityType,
        entityId,
        files,
      });
      if (res.success) {
        onUpdated();
        toast.success(`Uploaded ${files.length} file(s)`);
      } else {
        toast.error(res.error || 'Failed to upload attachments');
      }
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLinkExisting = async (docIdStr: string) => {
    setLinkingDocId(docIdStr);
    const documentId = Number(docIdStr);
    if (!documentId) return;
    const res = await testingService.linkExistingDocument(projectId, {
      entityType,
      entityId,
      documentId,
    });
    if (res.success) {
      setLinkingDocId('');
      onUpdated();
      toast.success('Document linked');
    } else {
      toast.error(res.error || 'Failed to link document');
    }
  };

  const handleRemove = async (att: TestingAttachmentDocument) => {
    const confirmed = await confirmDeleteSwal({
      title: 'Remove Attachment Link',
      text: `Remove "${att.displayName || att.originalName}" from this record? The document in Project Documents will be preserved.`,
      confirmText: 'Remove Link',
    });
    if (!confirmed) return;
    const res = await testingService.unlinkAttachment(projectId, {
      entityType,
      entityId,
      documentId: att.documentId,
    });
    if (res.success) {
      onUpdated();
      toast.success('Attachment unlinked');
    } else {
      toast.error(res.error || 'Failed to remove attachment');
    }
  };

  const linkedDocIds = new Set(attachments.map((a) => a.documentId));
  const linkableDocOptions: SelectOption[] = availableDocuments
    .filter((d) => !linkedDocIds.has(d.id))
    .map((d) => ({
      value: String(d.id),
      label: d.displayName,
      sublabel: formatBytes(d.sizeBytes),
    }));

  return (
    <div className="rounded-xl bg-[#13161B] border border-white/10 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-gray-300 border border-white/10">
            {attachments.length}
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            {linkableDocOptions.length > 0 && (
              <div className="w-56">
                <AnimatedSelect
                  options={linkableDocOptions}
                  value={linkingDocId}
                  onChange={(val) => void handleLinkExisting(val)}
                  placeholder="Link project document..."
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFilesSelected(e.target.files)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.01] py-5 text-center text-xs text-gray-500">
          No attachments yet. Upload screenshots, logs, test data, or link an existing project document.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.07] bg-[#0B0D10]/70 overflow-hidden">
          {attachments.map((att) => {
            const downloadUrl = documentService.getContentUrl(projectId, att.documentId, true);
            const isImage = att.mimeType?.startsWith('image/');
            const isInlinePreview = isImage || att.mimeType === 'application/pdf';
            const contentUrl = isInlinePreview
              ? documentService.getContentUrl(projectId, att.documentId, false)
              : downloadUrl;
            return (
              <div
                key={att.linkId || att.documentId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => setPreviewModalAtt(att)}
                      title="Click to view full image"
                      className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black/40 hover:border-emerald-500/50 transition-all cursor-pointer group"
                    >
                      <img
                        src={contentUrl}
                        alt={att.displayName || att.originalName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {att.displayName || att.originalName || `Document #${att.documentId}`}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                      <span>{formatBytes(att.sizeBytes)}</span>
                      <span>•</span>
                      <span>{formatTestingDateTime(att.createdAt)}</span>
                      {att.repositoryPath && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-400 truncate max-w-[200px]">
                            <Link2 className="w-2.5 h-2.5 shrink-0" />
                            {att.repositoryPath}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewModalAtt(att)}
                    title="Directly Preview Attachment"
                    className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in new tab / download"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    {isInlinePreview ? (
                      <ExternalLink className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void handleRemove(att)}
                      title="Remove attachment link"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for Direct Attachment Preview */}
      <AnimatePresence>
        {previewModalAtt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewModalAtt(null)}
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#12141C] border border-[#27272A] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#27272A] bg-[#161824]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold text-white text-sm truncate">
                    {previewModalAtt.displayName || previewModalAtt.originalName}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                    ({formatBytes(previewModalAtt.sizeBytes)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={documentService.getContentUrl(projectId, previewModalAtt.documentId, true)}
                    download
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Download original file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewModalAtt(null)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body Preview */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[#090A0F] min-h-[300px]">
                {previewModalAtt.mimeType?.startsWith('image/') ? (
                  <img
                    src={documentService.getContentUrl(projectId, previewModalAtt.documentId, false)}
                    alt={previewModalAtt.displayName || previewModalAtt.originalName}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                ) : previewModalAtt.mimeType === 'application/pdf' ? (
                  <iframe
                    src={documentService.getContentUrl(projectId, previewModalAtt.documentId, false)}
                    title={previewModalAtt.displayName || previewModalAtt.originalName}
                    className="w-full h-[70vh] rounded-lg border border-[#27272A]"
                  />
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <FileText className="w-12 h-12 text-zinc-500 mx-auto" />
                    <div className="text-sm text-zinc-300 font-medium">
                      {previewModalAtt.displayName || previewModalAtt.originalName}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Direct browser preview is not supported for this file type ({previewModalAtt.mimeType || 'unknown'}).
                    </p>
                    <a
                      href={documentService.getContentUrl(projectId, previewModalAtt.documentId, true)}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
