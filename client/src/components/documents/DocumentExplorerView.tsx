import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Briefcase,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  PenTool,
  Archive,
  Code,
  Shield,
  Layers,
  Globe,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Home,
  Plus,
  Upload,
  Loader2,
  GitBranch,
  Lock,
  ArrowUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAccentTheme } from '../../services/accentTheme.service';
import type { ProjectDocument, DocumentCategory } from '../../types/document';
import { DocumentToolbar, ViewMode, GroupByMode } from './DocumentToolbar';
import { DocumentListView } from './DocumentListView';
import { DocumentCardView } from './DocumentCardView';
import { DocumentGroupedView } from './DocumentGroupedView';

export interface FolderNode {
  id: number;
  name: string;
  fullName: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
  description?: string | null;
  documentCount: number;
  totalDocumentCount: number;
  parentId: number | null;
  children: FolderNode[];
  category: DocumentCategory;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Folder,
  Briefcase,
  FileText,
  Image: ImageIcon,
  BarChart3,
  Calendar,
  PenTool,
  Archive,
  Code,
  Shield,
  Layers,
  Globe,
};

export function getFolderIconComponent(iconName?: string | null) {
  if (!iconName) return Folder;
  return ICON_MAP[iconName] || Folder;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function buildFolderTree(categories: DocumentCategory[]): {
  rootNodes: FolderNode[];
  nodesById: Map<number, FolderNode>;
} {
  const nodesById = new Map<number, FolderNode>();
  const nameToId = new Map<string, number>();

  categories.forEach((cat) => {
    nameToId.set(cat.name.toLowerCase().trim(), cat.id);
    nodesById.set(cat.id, {
      id: cat.id,
      name: cat.name,
      fullName: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      description: cat.description,
      documentCount: cat._count?.documents || 0,
      totalDocumentCount: cat._count?.documents || 0,
      parentId: null,
      children: [],
      category: cat,
    });
  });

  const rootNodes: FolderNode[] = [];

  categories.forEach((cat) => {
    const node = nodesById.get(cat.id)!;
    const parts = cat.name
      .split(/\s*[\/\\]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    let attached = false;
    if (parts.length > 1) {
      // Walk longest prefix down to find nearest existing parent folder
      for (let i = parts.length - 1; i >= 1; i--) {
        const candidateParentName = parts.slice(0, i).join(' / ').toLowerCase();
        const candidateSlashName = parts.slice(0, i).join('/').toLowerCase();
        const parentId =
          nameToId.get(candidateParentName) ?? nameToId.get(candidateSlashName);

        if (parentId && parentId !== cat.id) {
          const parentNode = nodesById.get(parentId);
          if (parentNode) {
            node.parentId = parentId;
            node.name = parts.slice(i).join(' / ');
            parentNode.children.push(node);
            attached = true;
            break;
          }
        }
      }
    }

    if (!attached) {
      rootNodes.push(node);
    }
  });

  const computeTotals = (node: FolderNode): number => {
    const childrenTotal = node.children.reduce((sum, child) => sum + computeTotals(child), 0);
    node.totalDocumentCount = node.documentCount + childrenTotal;
    return node.totalDocumentCount;
  };
  rootNodes.forEach(computeTotals);

  return { rootNodes, nodesById };
}

export function getAncestorIds(
  categoryId: number | undefined,
  nodesById: Map<number, FolderNode>
): Set<number> {
  const ancestors = new Set<number>();
  if (!categoryId) return ancestors;

  let current = nodesById.get(categoryId);
  const visited = new Set<number>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ancestors.add(current.id);
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }
  return ancestors;
}

export function getFolderBreadcrumbs(
  categoryId: number | undefined,
  nodesById: Map<number, FolderNode>
): FolderNode[] {
  if (!categoryId) return [];
  const trail: FolderNode[] = [];
  let current = nodesById.get(categoryId);
  const visited = new Set<number>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    trail.unshift(current);
    current = current.parentId ? nodesById.get(current.parentId) : undefined;
  }
  return trail;
}

interface DocumentExplorerViewProps {
  projectId: number;
  categories: DocumentCategory[];
  documents: ProjectDocument[];
  totalRootDocuments?: number;
  totalStorageBytes?: number;
  repositoryName?: string;
  repositoryBranch?: string;
  selectedCategoryId?: number;
  onSelectCategory: (categoryId?: number) => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedFileType?: string;
  onSelectFileType: (type?: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  groupBy: GroupByMode;
  onGroupByChange: (group: GroupByMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDocIds: number[];
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSelectDocument: (doc: ProjectDocument) => void;
  onShareDocument: (doc: ProjectDocument) => void;
  onEditDocument: (doc: ProjectDocument) => void;
  onDeleteDocument: (doc: ProjectDocument) => void;
  onBulkDelete: () => void;
  onBulkMoveCategory: (catId: number | null) => void;
  onUploadClick: (targetFolderId?: number | null) => void;
  onNewFolderClick: (parentFolderId?: number | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

export const DocumentExplorerView: React.FC<DocumentExplorerViewProps> = ({
  projectId,
  categories,
  documents,
  totalRootDocuments,
  totalStorageBytes = 0,
  repositoryName,
  repositoryBranch = 'main',
  selectedCategoryId,
  onSelectCategory,
  search,
  onSearchChange,
  selectedFileType,
  onSelectFileType,
  sortBy,
  sortOrder,
  onSortChange,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
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
  onUploadClick,
  onNewFolderClick,
  onRefresh,
  isLoading,
  pagination,
  onPageChange,
}) => {
  const { accentColor } = useAccentTheme();
  const [showSidebar, setShowSidebar] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<number, boolean>>({});

  const { rootNodes, nodesById } = useMemo(() => buildFolderTree(categories), [categories]);

  const activeNode = selectedCategoryId ? nodesById.get(selectedCategoryId) : undefined;
  const breadcrumbs = useMemo(
    () => getFolderBreadcrumbs(selectedCategoryId, nodesById),
    [selectedCategoryId, nodesById]
  );

  // Auto-expand ancestor branches when user navigates into a folder or subfolder
  useEffect(() => {
    if (!selectedCategoryId) return;
    const ancestors = getAncestorIds(selectedCategoryId, nodesById);
    if (ancestors.size > 0) {
      setExpandedFolderIds((prev) => {
        const next = { ...prev };
        ancestors.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }
  }, [selectedCategoryId, nodesById]);

  const toggleExpand = (e: React.MouseEvent, folderId: number) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Subfolders to display inside the middle view
  const childFolders: FolderNode[] = useMemo(() => {
    if (activeNode) return activeNode.children;
    if (!search.trim()) return rootNodes;
    return [];
  }, [activeNode, rootNodes, search]);

  const totalRootCount =
    totalRootDocuments ??
    rootNodes.reduce((sum, n) => sum + n.totalDocumentCount, 0);

  const renderTreeNode = (node: FolderNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isSelected = selectedCategoryId === node.id;
    const isExpanded = Boolean(expandedFolderIds[node.id]);
    const color = node.color || '#3B82F6';
    const IconComp = isSelected && node.icon === 'Folder'
      ? FolderOpen
      : getFolderIconComponent(node.icon);

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          onClick={() => onSelectCategory(node.id)}
          className={cn(
            'group relative flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] transition-all cursor-pointer select-none border',
            isSelected
              ? 'text-white font-medium shadow-sm'
              : 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-[#17181D]/80'
          )}
          style={
            isSelected
              ? {
                  backgroundColor: `${accentColor}1f`,
                  borderColor: `${accentColor}55`,
                }
              : undefined
          }
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(e, node.id)}
                title={isExpanded ? 'Collapse folder' : 'Expand subfolders'}
                className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-white transition-colors shrink-0 cursor-pointer"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            <div
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${color}18`,
                color,
              }}
            >
              <IconComp size={12} />
            </div>

            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUploadClick(node.id);
              }}
              title={`Upload to ${node.name}`}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 transition-all cursor-pointer"
              onMouseEnter={(e) => {
                e.currentTarget.style.color = accentColor;
                e.currentTarget.style.backgroundColor = `${accentColor}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '';
                e.currentTarget.style.backgroundColor = '';
              }}
            >
              <Plus size={11} />
            </button>

            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                isSelected ? 'font-semibold' : 'bg-zinc-800/80 text-zinc-500'
              )}
              style={
                isSelected
                  ? { backgroundColor: `${accentColor}30`, color: accentColor }
                  : undefined
              }
            >
              {node.totalDocumentCount}
            </span>
          </div>
        </div>

        {/* Subfolder Tree Children */}
        <AnimatePresence initial={false}>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-l border-[#27272A] ml-4 pl-2 space-y-0.5"
            >
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ─── Left Column: Hierarchical Folder Root Sidebar ─────────────────── */}
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.aside
            initial={{ opacity: 0, width: 0, x: -12 }}
            animate={{ opacity: 1, width: 'auto', x: 0 }}
            exit={{ opacity: 0, width: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-64 xl:w-72 shrink-0 rounded-2xl border border-[#27272A] bg-[#0A0B0F]/95 shadow-lg overflow-hidden flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="px-3.5 py-3 border-b border-[#27272A]/80 flex items-center justify-between bg-[#0E0F14]/80">
              <div className="flex items-center gap-2">
                <FolderTree size={14} style={{ color: accentColor }} />
                <span className="text-xs font-semibold text-white tracking-tight">
                  Folder Root
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeNode && (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(activeNode.parentId ?? undefined)}
                    title={activeNode.parentId ? 'Go up one folder' : 'Back to Root'}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <ArrowUp size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNewFolderClick(selectedCategoryId ?? null)}
                  title={activeNode ? `New subfolder in ${activeNode.name}` : 'New root folder'}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                >
                  <FolderPlus size={13} />
                </button>
              </div>
            </div>

            {/* Active Root Breadcrumb Summary inside Sidebar when deep in a folder */}
            {activeNode && (
              <div
                className="px-3 py-2 border-b border-[#27272A]/60 flex items-center gap-1.5 text-[11px] text-zinc-400 overflow-x-auto scrollbar-none"
                style={{ backgroundColor: `${accentColor}0d` }}
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(undefined)}
                  className="hover:text-white transition-colors shrink-0 cursor-pointer"
                >
                  Root
                </button>
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight size={11} className="text-zinc-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => onSelectCategory(crumb.id)}
                        className={cn(
                          'truncate max-w-[110px] transition-colors cursor-pointer',
                          isLast ? 'text-blue-300 font-semibold' : 'hover:text-white'
                        )}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Folder Tree Body */}
            <div className="p-2.5 space-y-1 max-h-[460px] overflow-y-auto">
              {/* Root Item */}
              <button
                type="button"
                onClick={() => onSelectCategory(undefined)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[12px] transition-all cursor-pointer border',
                  selectedCategoryId === undefined
                    ? 'bg-blue-600/15 border-blue-500/35 text-white font-semibold shadow-sm'
                    : 'border-transparent text-zinc-300 hover:text-white hover:bg-[#17181D]/80'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    >
                    <Home size={12} />
                  </div>
                  <span className="truncate">All Documents (Root)</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0',
                    selectedCategoryId === undefined
                      ? 'bg-blue-500/25 text-blue-300'
                      : 'bg-zinc-800 text-zinc-400'
                  )}
                >
                  {totalRootCount}
                </span>
              </button>

              {/* Tree Divider */}
              <div className="px-2 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Directories ({categories.length})
                </span>
              </div>

              {/* Hierarchical Tree Nodes */}
              {rootNodes.length === 0 ? (
                <div className="py-6 px-3 text-center text-[11px] text-zinc-500 space-y-2">
                  <p>No folders created yet.</p>
                  <button
                    type="button"
                    onClick={() => onNewFolderClick(null)}
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Create folder</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {rootNodes.map((node) => renderTreeNode(node, 0))}
                </div>
              )}
            </div>

            {/* Sidebar Footer: GitHub Private Repo Storage Status */}
            <div className="p-3 border-t border-[#27272A]/70 bg-[#0E0F14]/70 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium text-zinc-300 truncate">
                  <Lock size={11} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{repositoryName || 'Private GitHub Storage'}</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 shrink-0">
                  <GitBranch size={10} />
                  {repositoryBranch}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                <span>Tracked Storage</span>
                <span className="text-zinc-300">{formatBytes(totalStorageBytes)}</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Middle Column: Breadcrumbs, Folder Header, Subfolders & Files ── */}
      <div className="flex-1 min-w-0 w-full space-y-4">
        {/* Breadcrumb & Active Folder Banner */}
        <div className="rounded-2xl border border-[#27272A] bg-[#0E0F14]/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectCategory(undefined)}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer',
                  !selectedCategoryId
                    ? 'text-blue-300 font-semibold bg-blue-500/10'
                    : 'hover:text-white hover:bg-white/[0.05]'
                )}
              >
                <Home size={11} />
                <span>Root</span>
              </button>

              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight size={12} className="text-zinc-600 shrink-0" />
                    <button
                      type="button"
                      onClick={() => onSelectCategory(crumb.id)}
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer truncate max-w-[160px]',
                        isLast
                          ? 'text-white font-semibold bg-white/[0.06]'
                          : 'hover:text-white hover:bg-white/[0.05]'
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: crumb.color || '#3B82F6' }}
                      />
                      <span className="truncate">{crumb.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Active Folder Name & Count */}
            <div className="flex items-center gap-2.5 pt-0.5">
              {activeNode ? (
                <>
                  {(() => {
                    const ActiveIcon = getFolderIconComponent(activeNode.icon);
                    const color = activeNode.color || '#3B82F6';
                    return (
                      <div
                        className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${color}15`,
                          borderColor: `${color}30`,
                          color,
                        }}
                      >
                        <ActiveIcon size={14} />
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {activeNode.name}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {pagination.total} files
                      </span>
                      {activeNode.children.length > 0 && (
                        <span
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                        >
                          {activeNode.children.length} subfolders
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">All Documents</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {pagination.total} files
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Context Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNewFolderClick(selectedCategoryId ?? null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-zinc-300 bg-[#17181D] hover:bg-[#1C1E26] hover:text-white border border-[#27272A] transition-colors cursor-pointer"
            >
              <FolderPlus size={13} className="text-amber-400" />
              <span>{activeNode ? 'New Subfolder' : 'New Folder'}</span>
            </button>
            <button
              type="button"
              onClick={() => onUploadClick(selectedCategoryId ?? null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-[#0A0B10] transition-all hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px -4px ${accentColor}50`,
              }}
            >
              <Upload size={13} />
              <span>{activeNode ? 'Upload Here' : 'Upload File'}</span>
            </button>
          </div>
        </div>

        {/* Integrated Toolbar (with AnimatedSelect File Types + Sidebar Toggle) */}
        <DocumentToolbar
          search={search}
          onSearchChange={onSearchChange}
          categories={categories}
          selectedFileType={selectedFileType}
          onSelectFileType={onSelectFileType}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          groupBy={groupBy}
          onGroupByChange={onGroupByChange}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onUploadClick={() => onUploadClick(selectedCategoryId ?? null)}
          onNewFolderClick={() => onNewFolderClick(selectedCategoryId ?? null)}
          onRefresh={onRefresh}
          isLoading={isLoading}
          showSidebar={showSidebar}
          onToggleSidebar={() => setShowSidebar((prev) => !prev)}
        />

        {/* Subfolders Grid inside Middle View (when current folder has subfolders, or root folders when at Root in Cards/List mode) */}
        {!isLoading &&
          childFolders.length > 0 &&
          viewMode !== 'hierarchy' &&
          groupBy !== 'folder' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  {activeNode ? `Subfolders (${childFolders.length})` : `Folders (${childFolders.length})`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {childFolders.map((sub) => {
                  const SubIcon = getFolderIconComponent(sub.icon);
                  const color = sub.color || '#3B82F6';
                  return (
                    <div
                      key={sub.id}
                      onClick={() => onSelectCategory(sub.id)}
                      className="group p-3 rounded-xl border border-[#27272A] bg-[#0E0F14]/95 hover:bg-[#17181D] cursor-pointer transition-all flex items-center justify-between gap-2 shadow-sm"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${accentColor}60`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '';
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${color}15`,
                            borderColor: `${color}30`,
                            color,
                          }}
                        >
                          <SubIcon size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                            {sub.name}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500">
                            {sub.totalDocumentCount} files
                            {sub.children.length > 0 && ` • ${sub.children.length} subfolders`}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUploadClick(sub.id);
                        }}
                        title={`Upload to ${sub.name}`}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white transition-colors shrink-0 cursor-pointer"
                        style={{ ['--hover-color' as any]: accentColor }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = accentColor;
                          e.currentTarget.style.backgroundColor = `${accentColor}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '';
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Document List / Cards / Hierarchy / Grouped Views */}
        {isLoading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-[#27272A] bg-[#0E0F14]/90 p-3.5 space-y-3">
                  <div className="h-24 rounded-lg bg-[#17181D]" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded bg-[#17181D]" />
                    <div className="h-2.5 w-1/2 rounded bg-[#14151B]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : documents.length === 0 && viewMode !== 'hierarchy' && groupBy !== 'folder' ? (
          <div className="py-16 px-4 rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F14]/60 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-[#27272A] flex items-center justify-center mx-auto text-zinc-500">
              <FolderOpen size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-zinc-200">
                {activeNode ? `No files in "${activeNode.name}" yet` : 'No matching documents found'}
              </h4>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                {search || selectedFileType
                  ? 'Try clearing your search or file type filter.'
                  : 'Upload documents here and DevFlow will commit them directly to your private GitHub repository.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUploadClick(selectedCategoryId ?? null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 6px 16px -4px ${accentColor}50`,
              }}
            >
              <Upload size={13} />
              <span>{activeNode ? `Upload to ${activeNode.name}` : 'Upload Document'}</span>
            </button>
          </div>
        ) : viewMode === 'hierarchy' || groupBy === 'folder' ? (
          <DocumentGroupedView
            projectId={projectId}
            documents={documents}
            categories={categories}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectDocument={onSelectDocument}
            onShareDocument={onShareDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onUploadToFolder={(catId) => onUploadClick(catId)}
            groupBy="folder"
          />
        ) : groupBy === 'date' ? (
          <DocumentGroupedView
            projectId={projectId}
            documents={documents}
            categories={categories}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectDocument={onSelectDocument}
            onShareDocument={onShareDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onUploadToFolder={(catId) => onUploadClick(catId)}
            groupBy="date"
          />
        ) : groupBy === 'type' ? (
          <DocumentGroupedView
            projectId={projectId}
            documents={documents}
            categories={categories}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectDocument={onSelectDocument}
            onShareDocument={onShareDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onUploadToFolder={(catId) => onUploadClick(catId)}
            groupBy="type"
          />
        ) : viewMode === 'list' ? (
          <DocumentListView
            projectId={projectId}
            documents={documents}
            categories={categories}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onClearSelection={onClearSelection}
            onSelectDocument={onSelectDocument}
            onShareDocument={onShareDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onBulkDelete={onBulkDelete}
            onBulkMoveCategory={onBulkMoveCategory}
          />
        ) : (
          <DocumentCardView
            projectId={projectId}
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectDocument={onSelectDocument}
            onShareDocument={onShareDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
          />
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]/70 text-xs text-zinc-400">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total files)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-[#27272A] bg-[#0E0F14] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-mono text-white">{pagination.page}</span>
              <button
                onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-[#27272A] bg-[#0E0F14] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

