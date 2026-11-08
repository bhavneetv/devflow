import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  CheckSquare,
  AlertCircle,
  FileText,
  Search,
  Loader2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { gitService } from '../../services/git.service';
import { apiUrl } from '../../config/api';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import type { GitRecordLinkItem } from '../../types/git';

export interface GitRecordLinkerProps {
  projectId: number;
  recordId: string; // canonical string ID e.g. "github:owner/repo:issue:12"
  recordType: 'issue' | 'merge_request' | 'commit' | 'branch';
  provider: 'github' | 'gitlab';
  recordNumber?: number;
  recordTitle?: string;
  recordUrl?: string;
  repositoryId?: number;
  onLinksChanged?: () => void;
}

export const GitRecordLinker: React.FC<GitRecordLinkerProps> = ({
  projectId,
  recordId,
  recordType,
  provider,
  recordNumber,
  recordTitle,
  recordUrl,
  repositoryId,
  onLinksChanged,
}) => {
  const { toast } = useToast();
  const [links, setLinks] = useState<GitRecordLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [targetType, setTargetType] = useState<'task' | 'requirement' | 'defect'>('task');
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Array<{ id: number; title: string; key?: string; status?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await gitService.getRecordLinks(projectId, recordId);
      if (res.success && res.data) {
        setLinks(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [projectId, recordId]);

  // Search candidate tasks or requirements
  useEffect(() => {
    if (!isLinkingOpen) return;

    let isCurrent = true;
    const searchTimer = setTimeout(async () => {
      try {
        setIsSearching(true);
        let endpoint = '';
        if (targetType === 'task' || targetType === 'defect') {
          endpoint = `/projects/${projectId}/tasks?search=${encodeURIComponent(searchQuery)}`;
        } else {
          endpoint = `/projects/${projectId}/requirements?search=${encodeURIComponent(searchQuery)}`;
        }

        const res = await fetch(apiUrl(endpoint)).then((r) => r.json()).catch(() => ({ success: false }));
        if (isCurrent && res.success && Array.isArray(res.data)) {
          setCandidates(
            res.data.map((item: any) => ({
              id: item.id,
              title: item.title || item.name || `Item #${item.id}`,
              key: item.identifier || item.key || `#${item.id}`,
              status: item.status,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isCurrent) setIsSearching(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(searchTimer);
    };
  }, [isLinkingOpen, targetType, searchQuery, projectId]);

  const handleLinkItem = async (candidateId: number) => {
    try {
      setIsSubmitting(true);
      const res = await gitService.createRecordLink(projectId, {
        recordId,
        provider,
        recordType,
        recordNumber,
        recordTitle,
        recordUrl,
        repositoryId,
        targetType,
        targetId: candidateId,
      });

      if (res.success) {
        toast.success('Record linked successfully');
        setIsLinkingOpen(false);
        setSearchQuery('');
        await fetchLinks();
        onLinksChanged?.();
      } else {
        toast.error(res.error || 'Failed to link item');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error linking record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async (linkId: number) => {
    try {
      const res = await gitService.deleteRecordLink(projectId, linkId);
      if (res.success) {
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        toast.info('Item unlinked');
        onLinksChanged?.();
      } else {
        toast.error(res.error || 'Failed to unlink item');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error unlinking item');
    }
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'task':
        return CheckSquare;
      case 'defect':
        return AlertCircle;
      case 'requirement':
        return FileText;
      default:
        return LinkIcon;
    }
  };

  const getTargetUrl = (type: string, id: number) => {
    switch (type) {
      case 'task':
        return `/projects/${projectId}/board?task=${id}`;
      case 'defect':
        return `/projects/${projectId}/defects?defect=${id}`;
      case 'requirement':
        return `/projects/${projectId}/requirements/${id}`;
      default:
        return '#';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <LinkIcon size={13} className="text-indigo-400" />
          <span>Linked DevFlow Items ({links.length})</span>
        </div>
        <button
          type="button"
          onClick={() => setIsLinkingOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={11} />
          <span>Link Item</span>
        </button>
      </div>

      {/* Linked items list */}
      {loading ? (
        <div className="p-3 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 size={13} className="animate-spin text-zinc-400" />
          <span>Loading linked items...</span>
        </div>
      ) : links.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-[#0E0F15] text-center text-xs text-zinc-500">
          No DevFlow tasks or requirements linked to this Git record yet.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80 rounded-xl border border-[#27272A] bg-[#0E0F15] overflow-hidden">
          {links.map((link) => {
            const IconComponent = getTargetIcon(link.targetType);
            const targetUrl = getTargetUrl(link.targetType, link.targetId);

            return (
              <div key={link.id} className="p-2.5 px-3 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900/40 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <IconComponent size={12} />
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={targetUrl}
                      className="font-medium text-zinc-200 hover:text-white truncate block hover:underline"
                    >
                      {link.targetDetails?.title || `${link.targetType.toUpperCase()} #${link.targetId}`}
                    </Link>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                      {link.targetType} • ID #{link.targetId}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnlink(link.id)}
                  className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                  title="Unlink"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Link item popover modal */}
      {isLinkingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121319] shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon size={15} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Link DevFlow Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkingOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Target type switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0E0F14] border border-zinc-800 text-xs">
              {(['task', 'defect', 'requirement'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTargetType(type)}
                  className={cn(
                    'py-1.5 rounded-lg font-medium capitalize transition-all cursor-pointer text-center',
                    targetType === type
                      ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search candidate */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${targetType}s by title...`}
                className="w-full pl-8.5 pr-3 py-2 text-xs bg-[#0E0F14] border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>

            {/* Candidate List */}
            <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-700">
              {isSearching ? (
                <div className="p-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 size={13} className="animate-spin text-zinc-400" />
                  <span>Searching...</span>
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No {targetType}s found matching your search.
                </div>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleLinkItem(c.id)}
                    className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-800/50 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                        {c.title}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-500">{c.key}</span>
                    </div>
                    <span className="text-[11px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                      Link
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLinkingOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

