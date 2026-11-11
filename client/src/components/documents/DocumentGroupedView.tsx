import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FileCode,
  Image as ImageIcon,
  Archive,
  Film,
  FileText,
  Calendar,
  FileType,
  Plus,
  Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProjectDocument, DocumentCategory } from '../../types/document';
import { DocumentCardView } from './DocumentCardView';
import { isToday, isThisWeek, isThisMonth } from '../../lib/dateUtils';

interface DocumentGroupedViewProps {
  projectId: number;
  documents: ProjectDocument[];
  categories: DocumentCategory[];
  selectedDocIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectDocument: (doc: ProjectDocument) => void;
  onShareDocument: (doc: ProjectDocument) => void;
  onEditDocument: (doc: ProjectDocument) => void;
  onDeleteDocument: (doc: ProjectDocument) => void;
  onUploadToFolder?: (categoryId: number) => void;
  groupBy?: 'folder' | 'type' | 'date';
  density?: 'compact' | 'comfortable';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface GroupItem {
  key: string;
  categoryId?: number;
  title: string;
  icon: any;
  color?: string;
  docs: ProjectDocument[];
  totalBytes: number;
}

export const DocumentGroupedView: React.FC<DocumentGroupedViewProps> = ({
  projectId,
  documents,
  categories,
  selectedDocIds,
  onToggleSelect,
  onSelectDocument,
  onShareDocument,
  onEditDocument,
  onDeleteDocument,
  onUploadToFolder,
  groupBy = 'folder',
  density = 'comfortable',
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedData: GroupItem[] = useMemo(() => {
    if (groupBy === 'folder') {
      // Create entries for all categories so empty folders are visible and have "+" icon
      const groups: GroupItem[] = categories.map((cat) => {
        const catDocs = documents.filter((d) => d.categoryId === cat.id);
        return {
          key: `cat-${cat.id}`,
          categoryId: cat.id,
          title: cat.name,
          icon: Folder,
          color: cat.color || '#3B82F6',
          docs: catDocs,
          totalBytes: catDocs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0),
        };
      });

      // Also include uncategorized files if any
      const uncategorizedDocs = documents.filter((d) => !d.categoryId);
      if (uncategorizedDocs.length > 0) {
        groups.push({
          key: 'uncategorized',
          title: 'General Files (No Folder)',
          icon: Folder,
          color: '#6B7280',
          docs: uncategorizedDocs,
          totalBytes: uncategorizedDocs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0),
        });
      }

      return groups;
    }

    if (groupBy === 'type') {
      const groups: Record<
        string,
        { title: string; icon: any; color?: string; docs: ProjectDocument[] }
      > = {};

      documents.forEach((doc) => {
        const ext = (doc.fileExtension || doc.extension || '').toLowerCase().replace('.', '');
        let typeKey = 'other';
        let typeTitle = 'Other Documents';
        let icon = FileText;
        let color = '#71717a';

        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
          typeKey = 'images';
          typeTitle = 'Images & Visuals';
          icon = ImageIcon;
          color = '#10B981';
        } else if (['pdf'].includes(ext)) {
          typeKey = 'pdf';
          typeTitle = 'PDF Documents';
          icon = FileText;
          color = '#EF4444';
        } else if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css'].includes(ext)) {
          typeKey = 'code';
          typeTitle = 'Source Code & Config';
          icon = FileCode;
          color = '#3B82F6';
        } else if (['mp4', 'mov', 'webm', 'mp3', 'wav'].includes(ext)) {
          typeKey = 'media';
          typeTitle = 'Media & Videos';
          icon = Film;
          color = '#8B5CF6';
        } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
          typeKey = 'archive';
          typeTitle = 'Compressed Archives';
          icon = Archive;
          color = '#F59E0B';
        }

        if (!groups[typeKey]) {
          groups[typeKey] = { title: typeTitle, icon, color, docs: [] };
        }
        groups[typeKey].docs.push(doc);
      });

      return Object.entries(groups).map(([key, data]) => ({
        key,
        categoryId: undefined,
        ...data,
        totalBytes: data.docs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0),
      }));
    }

    // Default: Group by Date
    const dateGroups: Record<
      string,
      { title: string; icon: any; color?: string; docs: ProjectDocument[] }
    > = {
      today: { title: 'Today', icon: Calendar, color: '#3B82F6', docs: [] },
      week: { title: 'This Week', icon: Calendar, color: '#10B981', docs: [] },
      month: { title: 'This Month', icon: Calendar, color: '#8B5CF6', docs: [] },
      older: { title: 'Older', icon: Calendar, color: '#6B7280', docs: [] },
    };

    documents.forEach((doc) => {
      const date = new Date(doc.createdAt);
      if (isToday(date)) {
        dateGroups.today.docs.push(doc);
      } else if (isThisWeek(date)) {
        dateGroups.week.docs.push(doc);
      } else if (isThisMonth(date)) {
        dateGroups.month.docs.push(doc);
      } else {
        dateGroups.older.docs.push(doc);
      }
    });

    return Object.entries(dateGroups)
      .filter(([_, data]) => data.docs.length > 0)
      .map(([key, data]) => ({
        key,
        categoryId: undefined,
        ...data,
        totalBytes: data.docs.reduce((acc, d) => acc + (d.sizeBytes || 0), 0),
      }));
  }, [groupBy, documents, categories]);

  return (
    <div className="space-y-3.5">
      {groupedData.length > 0 ? (
        groupedData.map((group) => {
          const isCollapsed = Boolean(collapsedGroups[group.key]);
          const GroupIcon = group.icon;

          return (
            <div
              key={group.key}
              className="rounded-2xl border border-[#27272A] bg-[#0E0F14]/90 overflow-hidden shadow-lg transition-all"
            >
              {/* Folder/Group Header */}
              <div
                onClick={() => toggleGroup(group.key)}
                className="p-3.5 sm:px-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(group.key);
                    }}
                    className="text-zinc-500 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>

                  <div
                    className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${group.color || '#3B82F6'}15`,
                      borderColor: `${group.color || '#3B82F6'}30`,
                      color: group.color || '#60A5FA',
                    }}
                  >
                    <GroupIcon size={14} />
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-[13px] text-white tracking-tight truncate">
                      {group.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      {group.docs.length} {group.docs.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </div>

                {/* Right side of folder header: Total Size & Plus icon for folder */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                    {formatBytes(group.totalBytes)}
                  </span>

                  {/* PLUS ICON on folder header: Click to upload directly to this folder! */}
                  {group.categoryId && onUploadToFolder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUploadToFolder(group.categoryId!);
                      }}
                      title={`Upload file to ${group.title}`}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white bg-[#17181D] hover:bg-blue-600/20 border border-[#27272A] hover:border-blue-500/40 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      <Plus size={13} className="text-blue-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Folder Documents Body */}
              {!isCollapsed && (
                <div className="p-3 sm:p-4 bg-[#14151B]/40 border-t border-[#27272A]/70">
                  {group.docs.length > 0 ? (
                    <DocumentCardView
                      projectId={projectId}
                      documents={group.docs}
                      selectedDocIds={selectedDocIds}
                      onToggleSelect={onToggleSelect}
                      onSelectDocument={onSelectDocument}
                      onShareDocument={onShareDocument}
                      onEditDocument={onEditDocument}
                      onDeleteDocument={onDeleteDocument}
                      density={density}
                    />
                  ) : (
                    <div className="py-8 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
                      <Folder size={20} className="text-zinc-600" />
                      <span>This folder is empty.</span>
                      {group.categoryId && onUploadToFolder && (
                        <button
                          type="button"
                          onClick={() => onUploadToFolder(group.categoryId!)}
                          className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Upload File to this Folder</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="py-16 text-center text-xs text-zinc-500 bg-[#0E0F14] rounded-2xl border border-dashed border-[#27272A]">
          No documents found.
        </div>
      )}
    </div>
  );
};
