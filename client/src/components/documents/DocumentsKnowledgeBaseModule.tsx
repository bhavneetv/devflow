import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FolderPlus,
  Settings,
  LayoutDashboard,
  Files,
  FileCheck2,
  FolderTree,
  Plus,
  GitBranch,
  FolderGit2,
  AlertTriangle,
  Link2,
  HardDrive,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ProjectDocument,
  DocumentCategory,
  DocumentDashboardData,
  DocumentApprovalEntry,
} from '../../types/document';
import { documentService } from '../../services/document.service';
import { useAccentTheme } from '../../services/accentTheme.service';
import { confirmDeleteSwal } from '../../lib/confirmAlert';
import { motion } from 'framer-motion';
import { DocumentsDashboard } from './DocumentsDashboard';
import { DocumentOverviewSidebar } from './DocumentOverviewSidebar';
import { ViewMode, GroupByMode } from './DocumentToolbar';
import { DocumentExplorerView, getFolderIconComponent } from './DocumentExplorerView';
import { DocumentApprovalsView } from './DocumentApprovalsView';
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

type TabKey = 'overview' | 'all' | 'approvals' | 'categories';

export const DocumentsKnowledgeBaseModule: React.FC<DocumentsKnowledgeBaseModuleProps> = ({
  projectId,
  submoduleId,
  submoduleName,
}) => {
  const { accentColor } = useAccentTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [dashboardData, setDashboardData] = useState<DocumentDashboardData | null>(null);
  const [isRelinking, setIsRelinking] = useState(false);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);

  // Approvals state
  const [approvals, setApprovals] = useState<DocumentApprovalEntry[]>([]);
  const [approvalCounts, setApprovalCounts] = useState({
    total: 0,
    approved: 0,
    declined: 0,
    pending: 0,
  });
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(false);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<
    'all' | 'approved' | 'declined' | 'pending'
  >('all');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [debouncedApprovalSearch, setDebouncedApprovalSearch] = useState('');

  // Explorer filters & controls
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | undefined>(undefined);
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

  // Search debounces
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedApprovalSearch(approvalSearch), 250);
    return () => clearTimeout(timer);
  }, [approvalSearch]);

  // Reset filters when switching between Document submodules
  useEffect(() => {
    setSelectedCategoryId(undefined);
    setSelectedAuthorId(undefined);
    setSelectedDocIds([]);
    setPagination((prev) => ({ ...prev, page: 1 }));
    setIsLoading(true);
  }, [submoduleId]);

  // Load Categories & Dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, catRes] = await Promise.all([
        documentService.getDashboard(projectId, submoduleId),
        documentService.listCategories(projectId, submoduleId),
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
  }, [projectId, submoduleId]);

  // Load document list based on active filters
  const loadDocuments = useCallback(async () => {
    setIsListLoading(true);
    try {
      const res = await documentService.listDocuments(projectId, {
        tab: 'all',
        submoduleId,
        categoryId: selectedCategoryId,
        authorId: selectedAuthorId,
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
    submoduleId,
    selectedCategoryId,
    selectedAuthorId,
    selectedFileType,
    debouncedSearch,
    sortBy,
    sortOrder,
    pagination.page,
    pagination.limit,
  ]);

  // Load PDF approval entries
  const loadApprovals = useCallback(async () => {
    setIsApprovalsLoading(true);
    try {
      const res = await documentService.listApprovals(
        projectId,
        approvalStatusFilter,
        debouncedApprovalSearch,
        submoduleId
      );
      if (res.success && res.data) {
        setApprovals(res.data.approvals);
        setApprovalCounts(res.data.counts);
      }
    } finally {
      setIsApprovalsLoading(false);
    }
  }, [projectId, submoduleId, approvalStatusFilter, debouncedApprovalSearch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'all') {
      loadDocuments();
    }
  }, [activeTab, loadDocuments]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

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
    const confirmed = await confirmDeleteSwal({
      title: 'Delete file?',
      text: 'This file will be permanently removed from DevFlow and your GitHub repository.',
      highlightLabel: doc.name,
      confirmText: 'Yes, delete file',
      accentColor,
    });
    if (!confirmed) return;

    const res = await documentService.deleteDocument(projectId, doc.id, true);
    if (res.success) {
      setSelectedDocForDrawer(null);
      setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
      loadDocuments();
      loadDashboard();
      loadApprovals();
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedDocIds.length;
    const confirmed = await confirmDeleteSwal({
      title: `Delete ${count} selected files?`,
      text: 'All selected files will be permanently removed from DevFlow and your GitHub repository.',
      highlightLabel: `${count} files`,
      confirmText: `Delete ${count} files`,
      accentColor,
    });
    if (!confirmed) return;

    await documentService.bulkDelete(projectId, selectedDocIds, true);
    setSelectedDocIds([]);
    loadDocuments();
    loadDashboard();
    loadApprovals();
  };

  const handleBulkMoveCategory = async (catId: number | null) => {
    await documentService.bulkMoveCategory(projectId, selectedDocIds, catId);
    setSelectedDocIds([]);
    loadDocuments();
    loadDashboard();
  };

  const handleRevokeApprovalShare = async (entry: DocumentApprovalEntry) => {
    const confirmed = await confirmDeleteSwal({
      title: 'Remove sharing link?',
      text: 'The public review link for this PDF will stop working immediately.',
      highlightLabel: entry.document?.name || 'Shared PDF',
      confirmText: 'Remove Sharing',
      accentColor,
    });
    if (!confirmed) return;

    const res = await documentService.revokeShare(projectId, entry.documentId, entry.shareId);
    if (res.success) {
      loadApprovals();
      loadDocuments();
      loadDashboard();
    }
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
    {
      key: 'approvals',
      label: 'Approve Files',
      icon: FileCheck2,
      count: approvalCounts.total > 0 ? approvalCounts.total : undefined,
    },
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
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-8 w-24 rounded-lg bg-[#17181D]" />
          ))}
        </div>

        {/* Overview Split Grid Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-9 space-y-5">
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
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-5 h-72" />
          </div>
          <div className="xl:col-span-3 space-y-5">
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-5 h-64" />
            <div className="rounded-2xl bg-[#0E0F14]/95 border border-[#27272A] p-5 h-56" />
          </div>
        </div>
      </div>
    );
  }

  const authorOptions = React.useMemo(() => {
    const map = new Map<number, { id: number; name: string; email?: string; avatarUrl?: string; avatarColor?: string }>();
    for (const doc of documents) {
      const u = doc.createdBy;
      const id = u?.id || doc.createdById;
      if (id && !map.has(id)) {
        map.set(id, {
          id,
          name: u?.name || doc.createdByName || `User #${id}`,
          email: u?.email || '',
          avatarUrl: u?.avatarUrl || undefined,
        });
      }
    }
    return Array.from(map.values());
  }, [documents]);

  const sharedExplorerProps = {
    projectId,
    categories,
    documents,
    authorOptions,
    selectedAuthorId,
    onSelectAuthorId: (id?: number) => {
      setSelectedAuthorId(id);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    totalRootDocuments: dashboardData?.metrics.totalDocuments,
    totalStorageBytes: dashboardData?.metrics.totalSize || 0,
    repositoryName:
      dashboardData?.storageNotice?.repositoryName ||
      dashboardData?.metrics.storageHealth?.repository ||
      undefined,
    repositoryBranch:
      dashboardData?.storageNotice?.defaultBranch ||
      dashboardData?.storageNotice?.branch ||
      dashboardData?.metrics.storageHealth?.branch ||
      'main',
    selectedCategoryId,
    onSelectCategory: handleSelectCategory,
    search,
    onSearchChange: handleSearchChange,
    selectedFileType,
    onSelectFileType: handleSelectFileType,
    sortBy,
    sortOrder,
    onSortChange: (sb: string, so: 'asc' | 'desc') => {
      setSortBy(sb);
      setSortOrder(so);
    },
    groupBy,
    onGroupByChange: setGroupBy,
    viewMode,
    onViewModeChange: setViewMode,
    selectedDocIds,
    onToggleSelect: handleToggleSelect,
    onSelectAll: handleSelectAll,
    onClearSelection: () => setSelectedDocIds([]),
    onSelectDocument: (doc: ProjectDocument) => setSelectedDocForDrawer(doc),
    onShareDocument: (doc: ProjectDocument) => setSelectedDocForShare(doc),
    onEditDocument: (doc: ProjectDocument) => setSelectedDocForDrawer(doc),
    onDeleteDocument: handleDeleteDoc,
    onBulkDelete: handleBulkDelete,
    onBulkMoveCategory: handleBulkMoveCategory,
    onUploadClick: (folderId?: number | null) => handleOpenUploadForFolder(folderId ?? null),
    onNewFolderClick: (parentId?: number | null) => handleOpenNewFolder(parentId ?? null),
    onRefresh: loadDocuments,
    isLoading: isListLoading,
    pagination,
    onPageChange: (page: number) => setPagination((prev) => ({ ...prev, page })),
  };

  const isStorageUnlinked = Boolean(dashboardData?.isStorageUnlinked);
  const scopeMeta = dashboardData?.scopeMeta;
  const resolvedTitle = scopeMeta?.submoduleName || submoduleName || 'Documents & Knowledge Base';

  const handleQuickRelink = async () => {
    setIsRelinking(true);
    try {
      const res = await documentService.relinkStorage(projectId);
      if (res.success) {
        await Promise.all([loadDashboard(), loadDocuments(), loadApprovals()]);
      }
    } finally {
      setIsRelinking(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ─── Top Module Header (Team Index Page Style) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#27272A]/70">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {resolvedTitle}
            </h2>
            {scopeMeta && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#14161D] border border-[#27272A] text-zinc-300">
                {scopeMeta.storageMode === 'branch' ? (
                  <>
                    <GitBranch size={11} style={{ color: accentColor }} />
                    <span>Branch: {scopeMeta.branchName}</span>
                  </>
                ) : (
                  <>
                    <FolderGit2 size={11} style={{ color: accentColor }} />
                    <span>Folder: /{scopeMeta.pathPrefix}</span>
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            Centralized project specs, wikis, and design assets backed by your dedicated private GitHub repository
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleOpenUploadForFolder(selectedCategoryId ?? null)}
            disabled={isStorageUnlinked}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 6px 18px -4px ${accentColor}55`,
            }}
          >
            <Upload size={14} />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => handleOpenNewFolder(selectedCategoryId ?? null)}
            disabled={isStorageUnlinked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 bg-[#0E0F14] hover:bg-[#1C1E26] hover:text-white border border-[#27272A] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

      {isStorageUnlinked ? (
        <div className="rounded-2xl bg-[#0E0F14]/95 border border-amber-500/30 p-8 sm:p-10 shadow-2xl text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle size={26} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white tracking-tight">
              Document Storage Repository Unlinked
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto">
              This project&apos;s GitHub storage repository (
              <span className="font-mono text-zinc-200">
                {dashboardData?.storageNotice?.providerOwner && dashboardData?.storageNotice?.repositoryName
                  ? `${dashboardData.storageNotice.providerOwner}/${dashboardData.storageNotice.repositoryName}`
                  : 'linked repository'}
              </span>
              ) has been unlinked in Project Settings. While unlinked, uploaded documents, folders, and share links are hidden and inaccessible.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleQuickRelink}
              disabled={isRelinking}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110 disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 8px 20px -4px ${accentColor}55`,
              }}
            >
              <Link2 size={14} />
              <span>{isRelinking ? 'Relinking Repository...' : 'Relink Previous Repository'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/settings/storage`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-200 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] transition-colors cursor-pointer"
            >
              <HardDrive size={14} />
              <span>Open Storage Settings</span>
            </button>
          </div>
        </div>
      ) : (
        <>
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

      {/* ─── Tab 1: Overview (3 Summary Cards + All Files Explorer Left, Summary Box Right) ─ */}
      {activeTab === 'overview' && dashboardData && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-9 min-w-0 space-y-5">
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

            <DocumentExplorerView {...sharedExplorerProps} />
          </div>

          <div className="xl:col-span-3 space-y-5">
            <DocumentOverviewSidebar
              data={dashboardData}
              onUploadClick={() => handleOpenUploadForFolder(null)}
              onNewFolderClick={() => handleOpenNewFolder(null)}
              onApprovalsClick={() => setActiveTab('approvals')}
              onSettingsClick={() => setIsSettingsOpen(true)}
            />
          </div>
        </div>
      )}

      {/* ─── Tab 2: All Files (Full Width Explorer) ───────────────────────── */}
      {activeTab === 'all' && <DocumentExplorerView {...sharedExplorerProps} />}

      {/* ─── Tab 3: Approve Files (PDF Approvals) ─────────────────────────── */}
      {activeTab === 'approvals' && (
        <DocumentApprovalsView
          projectId={projectId}
          approvals={approvals}
          counts={approvalCounts}
          isLoading={isApprovalsLoading}
          statusFilter={approvalStatusFilter}
          onStatusFilterChange={setApprovalStatusFilter}
          searchQuery={approvalSearch}
          onSearchChange={setApprovalSearch}
          onPreviewDocument={(doc) => setSelectedDocForDrawer(doc)}
          onRevokeShare={handleRevokeApprovalShare}
          onRefresh={loadApprovals}
        />
      )}

      {/* ─── Tab 4: Folders Grid Overview ─────────────────────────────────── */}
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
        </>
      )}

      {/* ─── Modals & Drawers ─────────────────────────────────────────────── */}
      <DocumentUploadDialog
        projectId={projectId}
        submoduleId={submoduleId ?? scopeMeta?.submoduleId ?? undefined}
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
          loadDocuments();
          loadApprovals();
        }}
        onShareRevoked={() => {
          loadDashboard();
          loadDocuments();
          loadApprovals();
        }}
      />

      <DocumentSettingsModal
        projectId={projectId}
        submoduleId={submoduleId ?? scopeMeta?.submoduleId ?? undefined}
        scopeMeta={scopeMeta}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={() => {
          loadDashboard();
        }}
      />

      <CategoryManageModal
        projectId={projectId}
        submoduleId={submoduleId ?? scopeMeta?.submoduleId ?? undefined}
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
