import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  FolderPlus,
  Settings,
  LayoutDashboard,
  Files,
  UserCheck,
  Share2,
  Clock,
  FolderTree,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ProjectDocument,
  DocumentCategory,
  DocumentDashboardData,
} from '../../types/document';
import { documentService } from '../../services/document.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { motion } from 'framer-motion';
import { DocumentsDashboard } from './DocumentsDashboard';
import { DocumentToolbar, ViewMode, GroupByMode } from './DocumentToolbar';
import { DocumentCardView } from './DocumentCardView';
import { DocumentListView } from './DocumentListView';
import { DocumentGroupedView } from './DocumentGroupedView';
import { DocumentExplorerView, getFolderIconComponent } from './DocumentExplorerView';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { DocumentDetailsDrawer } from './DocumentDetailsDrawer';
import { DocumentShareModal } from './DocumentShareModal';
import { DocumentSettingsModal } from './DocumentSettingsModal';
import { CategoryManageModal } from './CategoryManageModal';

interface DocumentsKnowledgeBaseModuleProps {
  projectId: number;
  submoduleId?: number;
  submoduleName?: string;
}

type TabKey = 'overview' | 'all' | 'my_uploads' | 'shared' | 'recent' | 'categories';

export const DocumentsKnowledgeBaseModule: React.FC<DocumentsKnowledgeBaseModuleProps> = ({
  projectId,
  submoduleId: _submoduleId,
  submoduleName,
}) => {
  const { accentColor } = useAccentTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [dashboardData, setDashboardData] = useState<DocumentDashboardData | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);

  // Filters & Controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [selectedFileType, setSelectedFileType] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);

  // Modals & Panels
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [targetFolderIdForUpload, setTargetFolderIdForUpload] = useState<number | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [parentFolderIdForCreate, setParentFolderIdForCreate] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDocForDrawer, setSelectedDocForDrawer] = useState<ProjectDocument | null>(null);
  const [selectedDocForShare, setSelectedDocForShare] = useState<ProjectDocument | null>(null);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Categories & Dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, catRes] = await Promise.all([
        documentService.getDashboard(projectId),
        documentService.listCategories(projectId),
      ]);
      if (dashRes.success && dashRes.data) {
        setDashboardData(dashRes.data);
      }
      if (catRes.success && catRes.data) {
        setCategories(catRes.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load document list based on active filters
  const loadDocuments = useCallback(async () => {
    setIsListLoading(true);
    try {
      const mappedTab =
        activeTab === 'my_uploads'
          ? 'my_uploads'
          : activeTab === 'shared'
          ? 'shared'
          : activeTab === 'recent'
          ? 'recent'
          : 'all';

      const res = await documentService.listDocuments(projectId, {
        tab: mappedTab,
        categoryId: selectedCategoryId,
        fileType: selectedFileType,
        search: debouncedSearch || undefined,
        sortBy: sortBy as any,
        sortOrder,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (res.success && res.data) {
        setDocuments(res.data.documents);
        setPagination({
          page: res.data.page,
          limit: res.data.limit,
          total: res.data.total,
          totalPages: res.data.totalPages,
        });
      }
    } finally {
      setIsListLoading(false);
    }
  }, [
    projectId,
    activeTab,
    selectedCategoryId,
    selectedFileType,
    debouncedSearch,
    sortBy,
    sortOrder,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab !== 'overview') {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  // Selection toggles
  const handleToggleSelect = (id: number) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  };

  // Actions
  const handleDeleteDoc = async (doc: ProjectDocument) => {
    if (window.confirm(`Are you sure you want to delete "${doc.name}"? It will also be removed from your GitHub repository.`)) {
      const res = await documentService.deleteDocument(projectId, doc.id, true);
      if (res.success) {
        setSelectedDocForDrawer(null);
        setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
        loadDocuments();
        loadDashboard();
      }
    }
  };

  const handleBulkDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedDocIds.length} files? They will be removed from your GitHub repository.`
      )
    ) {
      await documentService.bulkDelete(projectId, selectedDocIds, true);
      setSelectedDocIds([]);
      loadDocuments();
      loadDashboard();
    }
  };

  const handleBulkMoveCategory = async (catId: number | null) => {
    await documentService.bulkMoveCategory(projectId, selectedDocIds, catId);
    setSelectedDocIds([]);
    loadDocuments();
    loadDashboard();
  };

  const handleOpenUploadForFolder = (folderId: number | null) => {
    setTargetFolderIdForUpload(folderId ?? null);
    setIsUploadOpen(true);
  };

  const handleOpenNewFolder = (parentId: number | null = null) => {
    setParentFolderIdForCreate(parentId ?? null);
    setIsCategoryOpen(true);
  };

  const handleSelectCategory = (categoryId?: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedDocIds([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSelectFileType = (type?: string) => {
    setSelectedFileType(type);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const TABS: Array<{
    key: TabKey;
    label: string;
    icon: any;
    count?: number;
  }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'all', label: 'All Files', icon: Files, count: dashboardData?.metrics.totalDocuments },
    { key: 'my_uploads', label: 'My Uploads', icon: UserCheck },
    { key: 'shared', label: 'Shared Links', icon: Share2, count: dashboardData?.metrics.activeShares },
    { key: 'recent', label: 'Recent', icon: Clock },
    { key: 'categories', label: 'Folders', icon: FolderTree, count: categories.length },
  ];

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
          <div className="space-y-2">
            <div className="h-8 w-72 rounded-xl bg-[#17181D]" />
            <div className="h-4 w-96 max-w-full rounded-lg bg-[#14151B]" />
          </div>
          <div className="h-9 w-32 rounded-xl bg-[#17181D]" />
        </div>

        {/* Sliding Tabs Skeleton */}
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[#0A0B0F] border border-[#27272A]/80">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-8 w-24 rounded-lg bg-[#17181D]/80" />
          ))}
        </div>

        {/* Metrics & Panels Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3.5 w-24 rounded bg-[#17181D]" />
                  <div className="h-7 w-16 rounded-lg bg-[#1C1E26]" />
                </div>
                <div className="w-11 h-11 rounded-xl bg-[#17181D]" />
              </div>
              <div className="h-3 w-36 rounded bg-[#14151B]" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-[#17181D] mb-4" />
              {Array.from({ length: 4 }).map((__, rowIdx) => (
                <div key={rowIdx} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#17181D]" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-44 rounded bg-[#17181D]" />
                      <div className="h-2.5 w-28 rounded bg-[#14151B]" />
                    </div>
                  </div>
                  <div className="h-5 w-12 rounded bg-[#17181D]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Top Module Header (Team Index Page Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {submoduleName || 'Documents & Knowledge Base'}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Centralized project specs, wikis, and design assets backed by your dedicated private GitHub repository
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleOpenUploadForFolder(activeTab === 'all' ? (selectedCategoryId ?? null) : null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 6px 18px -4px ${accentColor}55`,
            }}
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => handleOpenNewFolder(activeTab === 'all' ? (selectedCategoryId ?? null) : null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 bg-[#0E0F14] hover:bg-[#1C1E26] hover:text-white border border-[#27272A] transition-colors cursor-pointer"
          >
            <FolderPlus size={14} />
            <span>New Folder</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white bg-[#0E0F14] hover:bg-[#1C1E26] border border-[#27272A] transition-colors cursor-pointer"
            title="Storage & GitHub Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* ─── Sliding Button Tabs Navigation ───────────────────────────────── */}
      <div className="overflow-x-auto scrollbar-none pb-0.5">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0A0B0F] border border-[#27272A]/80 shadow-inner">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedDocIds([]);
                }}
                className={cn(
                  'relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer text-[12px] select-none',
                  isActive ? 'text-[#0A0B10]' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="documentsModuleActiveTabPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg -z-10"
                    style={{
                      backgroundColor: accentColor,
                      boxShadow: `0 4px 14px -2px ${accentColor}66`,
                    }}
                  />
                )}
                <Icon size={14} className={isActive ? 'text-[#0A0B10]' : 'text-zinc-500'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                      isActive
                        ? 'bg-black/15 text-[#0A0B10]'
                        : 'bg-zinc-800/90 text-zinc-400'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab 1: Overview Dashboard ────────────────────────────────────── */}
      {activeTab === 'overview' && dashboardData && (
        <DocumentsDashboard
          projectId={projectId}
          data={dashboardData}
          onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
          onUploadClick={() => handleOpenUploadForFolder(null)}
          onNewCategoryClick={() => handleOpenNewFolder(null)}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onViewAllClick={() => setActiveTab('all')}
          onRefresh={loadDashboard}
        />
      )}

      {/* ─── Tab 6: Folders Grid Overview ─────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Folders organize project technical documentation and media
            </span>
            <button
              onClick={() => handleOpenNewFolder(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all shadow-sm cursor-pointer hover:brightness-110"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 6px 18px -4px ${accentColor}50`,
              }}
            >
              <FolderPlus size={13} />
              <span>New Folder</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {categories.map((c) => {
              const IconComp = getFolderIconComponent(c.icon);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    handleSelectCategory(c.id);
                    setActiveTab('all');
                  }}
                  className="p-4 rounded-2xl border border-[#27272A] bg-[#0E0F14]/95 hover:border-zinc-700 hover:bg-[#17181D]/60 cursor-pointer transition-all space-y-2 group shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${c.color || '#3B82F6'}15`,
                          borderColor: `${c.color || '#3B82F6'}30`,
                          color: c.color || '#60A5FA',
                        }}
                      >
                        <IconComp size={14} />
                      </div>
                      <h4 className="font-semibold text-xs text-zinc-200 group-hover:text-white truncate">
                        {c.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-800">
                        {c._count?.documents || 0} files
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUploadForFolder(c.id);
                        }}
                        title={`Upload file to ${c.name}`}
                        className="p-1 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus size={13} style={{ color: accentColor }} />
                      </button>
                    </div>
                  </div>
                  {c.description && (
                    <p className="text-[11px] text-zinc-500 line-clamp-2">{c.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Tab 2: All Files (Folder Root Sidebar + Middle Explorer View) ─── */}
      {activeTab === 'all' && (
        <DocumentExplorerView
          projectId={projectId}
          categories={categories}
          documents={documents}
          totalRootDocuments={dashboardData?.metrics.totalDocuments}
          totalStorageBytes={dashboardData?.metrics.totalSize || 0}
          repositoryName={
            dashboardData?.storageNotice?.repositoryName ||
            dashboardData?.metrics.storageHealth?.repository ||
            undefined
          }
          repositoryBranch={
            dashboardData?.storageNotice?.branch ||
            dashboardData?.metrics.storageHealth?.branch ||
            'main'
          }
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
          search={search}
          onSearchChange={handleSearchChange}
          selectedFileType={selectedFileType}
          onSelectFileType={handleSelectFileType}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(sb, so) => {
            setSortBy(sb);
            setSortOrder(so);
          }}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDocIds={selectedDocIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onClearSelection={() => setSelectedDocIds([])}
          onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
          onShareDocument={(doc) => setSelectedDocForShare(doc)}
          onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
          onDeleteDocument={handleDeleteDoc}
          onBulkDelete={handleBulkDelete}
          onBulkMoveCategory={handleBulkMoveCategory}
          onUploadClick={(folderId) => handleOpenUploadForFolder(folderId ?? null)}
          onNewFolderClick={(parentId) => handleOpenNewFolder(parentId ?? null)}
          onRefresh={loadDocuments}
          isLoading={isListLoading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        />
      )}

      {/* ─── Tabs 3, 4, 5: My Uploads / Shared / Recent ────────────────────── */}
      {(activeTab === 'my_uploads' || activeTab === 'shared' || activeTab === 'recent') && (
        <div className="space-y-4">
          {/* Active Category Filter chip if filtered */}
          {selectedCategoryId && (
            <div
              className="flex items-center gap-2 p-2 px-3 rounded-xl border text-xs"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              <span>
                Filtered by folder:{' '}
                <strong className="text-white">
                  {categories.find((c) => c.id === selectedCategoryId)?.name || 'Folder'}
                </strong>
              </span>
              <button
                onClick={() => handleSelectCategory(undefined)}
                className="text-zinc-300 hover:text-white underline ml-auto text-[11px] cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Clean Streamlined Toolbar */}
          <DocumentToolbar
            search={search}
            onSearchChange={handleSearchChange}
            categories={categories}
            selectedFileType={selectedFileType}
            onSelectFileType={handleSelectFileType}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(sb, so) => {
              setSortBy(sb);
              setSortOrder(so);
            }}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onUploadClick={() => handleOpenUploadForFolder(null)}
            onNewFolderClick={() => handleOpenNewFolder(null)}
            onRefresh={loadDocuments}
            isLoading={isListLoading}
          />

          {/* Document Views: List, Card, Hierarchy (Folder-wise), or Grouped */}
          {isListLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 py-2 animate-pulse">
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
          ) : viewMode === 'hierarchy' || groupBy === 'folder' ? (
            <DocumentGroupedView
              projectId={projectId}
              documents={documents}
              categories={categories}
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelect}
              onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
              onShareDocument={(doc) => setSelectedDocForShare(doc)}
              onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
              onDeleteDocument={handleDeleteDoc}
              onUploadToFolder={handleOpenUploadForFolder}
              groupBy="folder"
            />
          ) : groupBy === 'date' ? (
            <DocumentGroupedView
              projectId={projectId}
              documents={documents}
              categories={categories}
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelect}
              onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
              onShareDocument={(doc) => setSelectedDocForShare(doc)}
              onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
              onDeleteDocument={handleDeleteDoc}
              onUploadToFolder={handleOpenUploadForFolder}
              groupBy="date"
            />
          ) : groupBy === 'type' ? (
            <DocumentGroupedView
              projectId={projectId}
              documents={documents}
              categories={categories}
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelect}
              onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
              onShareDocument={(doc) => setSelectedDocForShare(doc)}
              onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
              onDeleteDocument={handleDeleteDoc}
              onUploadToFolder={handleOpenUploadForFolder}
              groupBy="type"
            />
          ) : viewMode === 'list' ? (
            <DocumentListView
              projectId={projectId}
              documents={documents}
              categories={categories}
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onClearSelection={() => setSelectedDocIds([])}
              onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
              onShareDocument={(doc) => setSelectedDocForShare(doc)}
              onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
              onDeleteDocument={handleDeleteDoc}
              onBulkDelete={handleBulkDelete}
              onBulkMoveCategory={handleBulkMoveCategory}
            />
          ) : (
            <DocumentCardView
              projectId={projectId}
              documents={documents}
              selectedDocIds={selectedDocIds}
              onToggleSelect={handleToggleSelect}
              onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
              onShareDocument={(doc) => setSelectedDocForShare(doc)}
              onEditDocument={(doc) => setSelectedDocForDrawer(doc)}
              onDeleteDocument={handleDeleteDoc}
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
                  onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded-lg border border-[#27272A] bg-[#0E0F14] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-mono text-white">{pagination.page}</span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 rounded-lg border border-[#27272A] bg-[#0E0F14] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Modals & Drawers ─────────────────────────────────────────────── */}
      <DocumentUploadDialog
        projectId={projectId}
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setTargetFolderIdForUpload(null);
        }}
        categories={categories}
        initialCategoryId={targetFolderIdForUpload}
        onUploadSuccess={() => {
          loadDocuments();
          loadDashboard();
        }}
      />

      <DocumentDetailsDrawer
        projectId={projectId}
        document={selectedDocForDrawer}
        categories={categories}
        isOpen={Boolean(selectedDocForDrawer)}
        onClose={() => setSelectedDocForDrawer(null)}
        onUpdate={(updated) => {
          setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          loadDashboard();
        }}
        onShare={(doc) => {
          setSelectedDocForDrawer(null);
          setSelectedDocForShare(doc);
        }}
        onDelete={handleDeleteDoc}
      />

      <DocumentShareModal
        projectId={projectId}
        document={selectedDocForShare}
        isOpen={Boolean(selectedDocForShare)}
        onClose={() => setSelectedDocForShare(null)}
        onShareCreated={() => {
          loadDashboard();
        }}
      />

      <DocumentSettingsModal
        projectId={projectId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={() => {
          loadDashboard();
        }}
      />

      <CategoryManageModal
        projectId={projectId}
        isOpen={isCategoryOpen}
        onClose={() => {
          setIsCategoryOpen(false);
          setParentFolderIdForCreate(null);
        }}
        categories={categories}
        initialParentId={parentFolderIdForCreate}
        onCategoryCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat]);
          loadDashboard();
        }}
      />
    </div>
  );
};
