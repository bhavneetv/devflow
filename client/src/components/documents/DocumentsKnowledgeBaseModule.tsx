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
  Folder,
  Plus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ProjectDocument,
  DocumentCategory,
  DocumentDashboardData,
} from '../../types/document';
import { documentService } from '../../services/document.service';
import { DocumentsDashboard } from './DocumentsDashboard';
import { DocumentToolbar, ViewMode, GroupByMode } from './DocumentToolbar';
import { DocumentCardView } from './DocumentCardView';
import { DocumentListView } from './DocumentListView';
import { DocumentGroupedView } from './DocumentGroupedView';
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

  const handleOpenUploadForFolder = (folderId: number) => {
    setTargetFolderIdForUpload(folderId);
    setIsUploadOpen(true);
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
      <div className="py-24 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span>Loading Documents & Knowledge Base...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Top Module Header (Team Index Page Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {submoduleName || 'Documents & Knowledge Base'}
              </h2>
              <p className="text-xs text-zinc-400">
                Centralized project specs, wikis, and design assets backed by your dedicated private GitHub repository
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setTargetFolderIdForUpload(null);
              setIsUploadOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm shadow-blue-900/30 cursor-pointer"
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => setIsCategoryOpen(true)}
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

      {/* ─── Tabs Navigation ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-[#27272A]/70 overflow-x-auto text-xs pb-px scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedDocIds([]);
              }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer text-[12px]',
                isActive
                  ? 'border-blue-500 text-white bg-[#17181D]/60 rounded-t-xl'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-[#17181D]/20 rounded-t-xl'
              )}
            >
              <Icon size={14} className={isActive ? 'text-blue-400' : 'text-zinc-500'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                    isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab 1: Overview Dashboard ────────────────────────────────────── */}
      {activeTab === 'overview' && dashboardData && (
        <DocumentsDashboard
          projectId={projectId}
          data={dashboardData}
          onSelectDocument={(doc) => setSelectedDocForDrawer(doc)}
          onUploadClick={() => {
            setTargetFolderIdForUpload(null);
            setIsUploadOpen(true);
          }}
          onNewCategoryClick={() => setIsCategoryOpen(true)}
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
              onClick={() => setIsCategoryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm cursor-pointer"
            >
              <FolderPlus size={13} />
              <span>New Folder</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {categories.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCategoryId(c.id);
                  setActiveTab('all');
                }}
                className="p-4 rounded-2xl border border-[#27272A] bg-[#0E0F14]/95 hover:border-zinc-700 hover:bg-[#17181D]/60 cursor-pointer transition-all space-y-2 group shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${c.color || '#3B82F6'}15`,
                        borderColor: `${c.color || '#3B82F6'}30`,
                        color: c.color || '#60A5FA',
                      }}
                    >
                      <Folder size={14} />
                    </div>
                    <h4 className="font-semibold text-xs text-zinc-200 group-hover:text-white">
                      {c.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1.5">
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
                      <Plus size={13} className="text-blue-400" />
                    </button>
                  </div>
                </div>
                {c.description && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2">{c.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tabs 2, 3, 4, 5: All Files / My Uploads / Shared / Recent ────── */}
      {activeTab !== 'overview' && activeTab !== 'categories' && (
        <div className="space-y-4">
          {/* Active Category Filter chip if filtered */}
          {selectedCategoryId && (
            <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-blue-950/20 border border-blue-500/25 text-xs text-blue-300">
              <span>
                Filtered by folder:{' '}
                <strong>
                  {categories.find((c) => c.id === selectedCategoryId)?.name || 'Folder'}
                </strong>
              </span>
              <button
                onClick={() => setSelectedCategoryId(undefined)}
                className="text-blue-400 hover:text-white underline ml-auto text-[11px] cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Clean Streamlined Toolbar */}
          <DocumentToolbar
            search={search}
            onSearchChange={setSearch}
            categories={categories}
            selectedFileType={selectedFileType}
            onSelectFileType={setSelectedFileType}
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
            onUploadClick={() => {
              setTargetFolderIdForUpload(null);
              setIsUploadOpen(true);
            }}
            onNewFolderClick={() => setIsCategoryOpen(true)}
            onRefresh={loadDocuments}
            isLoading={isListLoading}
          />

          {/* Document Views: List, Card, Hierarchy (Folder-wise), or Grouped */}
          {isListLoading ? (
            <div className="py-20 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-blue-500" />
              <span>Fetching documents...</span>
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
        onClose={() => setIsCategoryOpen(false)}
        categories={categories}
        onCategoryCreated={(newCat) => {
          setCategories((prev) => [...prev, newCat]);
          loadDashboard();
        }}
      />
    </div>
  );
};
