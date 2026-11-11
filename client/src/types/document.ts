export interface ProjectDocument {
  id: number;
  projectId: number;
  submoduleId?: number | null;
  branch?: string | null;
  categoryId?: number | null;
  name: string;
  displayName?: string;
  originalName: string;
  description?: string | null;
  fileExtension: string;
  extension?: string;
  mimeType: string;
  sizeBytes: number;
  gitHubPath: string;
  gitHubSha?: string | null;
  gitHubBlobUrl?: string | null;
  tags: string[];
  version: number;
  isArchived: boolean;
  downloadCount: number;
  createdById: number;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: DocumentCategory | null;
  createdBy?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  shares?: DocumentShare[];
  activities?: DocumentActivity[];
}

export interface DocumentCategory {
  id: number;
  projectId: number;
  submoduleId?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isSystemDefault: boolean;
  position: number;
  _count?: {
    documents: number;
  };
}

export interface DocumentShare {
  id: number;
  documentId: number;
  shareType: 'internal' | 'public' | 'internal_member' | 'external_link';
  permission: 'view' | 'download' | 'full';
  permissionLevel?: string;
  sharedWithUserId?: number | null;
  sharedWithTeamId?: number | null;
  token?: string | null;
  tokenHash?: string | null;
  hasPassword?: boolean;
  message?: string | null;
  shareMessage?: string | null;
  allowApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'declined' | null;
  approvalActorName?: string | null;
  approvalNote?: string | null;
  approvalActedAt?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
  downloadCount: number;
  createdById: number;
  createdAt: string;
  shareUrl?: string;
  createdBy?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  } | null;
  sharedWithUser?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  sharedWithTeam?: {
    id: number;
    name: string;
  } | null;
}

export interface DocumentActivity {
  id: number;
  documentId: number;
  userId?: number | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  } | null;
  document?: {
    id: number;
    name: string;
    fileExtension: string;
  } | null;
}

export interface ProjectStorageConnection {
  id: number;
  projectId: number;
  provider: string;
  repositoryName: string;
  repositoryOwner: string;
  repositoryBranch: string;
  isPrivate: boolean;
  status: string;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  repoUrl?: string | null;
}

export interface DocumentModuleSettings {
  id: number;
  projectId: number;
  maxUploadSizeMb: number;
  allowedExtensions: string[];
  blockedExtensions: string[];
  duplicateHandling: 'rename' | 'replace' | 'reject';
  enableExternalSharing: boolean;
  requireSharePassword: boolean;
}

export interface DocumentScopeMeta {
  submoduleId: number | null;
  submoduleName: string;
  isPrimary: boolean;
  storageMode: 'folder' | 'branch';
  branchName: string;
  pathPrefix: string;
}

export interface StorageBranchUsage {
  name: string;
  commitSha?: string | null;
  isDefault: boolean;
  protected: boolean;
  fileCount: number;
  trackedBytes: number;
  gitHubTreeBytes?: number | null;
  gitHubBlobCount?: number | null;
  moduleNames: string[];
}

export interface StorageModuleUsage {
  submoduleId: number;
  submoduleName: string;
  moduleId: number;
  moduleName: string;
  builtInKey: string;
  isPrimary: boolean;
  storageMode: 'folder' | 'branch';
  branchName: string;
  folderPath: string;
  fileCount: number;
  sizeBytes: number;
}

export interface ProjectStorageOverview {
  storageConnection: {
    id?: number;
    projectId?: number;
    provider?: string;
    providerOwner?: string | null;
    repositoryName?: string | null;
    repositoryUrl?: string | null;
    defaultBranch?: string;
    connectionStatus?: 'connected' | 'unlinked' | 'disconnected' | 'error' | string;
    lastSyncAt?: string | null;
    providerConnection?: {
      accountName?: string | null;
      accountEmail?: string | null;
      status?: string | null;
    } | null;
  } | null;
  health?: {
    isHealthy: boolean;
    connectionStatus?: string;
    repositoryUrl?: string;
    repositoryName?: string;
    defaultBranch?: string;
    isPrivate?: boolean;
    repoSizeKb?: number;
    rateLimitRemaining?: number;
    rateLimitLimit?: number;
    error?: string;
  };
  usage?: {
    totalTrackedBytes: number;
    totalFiles: number;
    configuredLimitBytes: number;
    repoGitHubSizeKb?: number | null;
    repoGitHubSizeBytes?: number | null;
    isPrivate?: boolean;
  };
  branches?: StorageBranchUsage[];
  modules?: StorageModuleUsage[];
}

export interface AccessibleStorageRepo {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  webUrl: string;
  sizeKb: number;
}

export interface DocumentDashboardData {
  isStorageUnlinked?: boolean;
  scopeMeta?: DocumentScopeMeta;
  metrics: {
    totalDocuments: number;
    totalFiles?: number;
    totalSize: number;
    totalSizeBytes?: number;
    repoTotalSizeBytes?: number;
    moduleSizeBytes?: number;
    documentsUploadedThisMonth: number;
    activeShares: number;
    sharedCount?: number;
    internalShares: number;
    externalShares: number;
    totalDownloads: number;
    categoryCount: number;
    imagesCount?: number;
    documentsCount?: number;
    videosCount?: number;
    othersCount?: number;
    configuredLimitBytes?: number;
    approvedCount?: number;
    pendingApprovals?: number;
    declinedApprovals?: number;
    storageHealth?: {
      status: 'healthy' | 'warning' | 'error' | 'unconfigured';
      repository: string | null;
      owner: string | null;
      branch: string;
      isPrivate: boolean;
      freeStorage: boolean;
      repoUrl?: string | null;
    };
  };
  projectMeta?: {
    title: string;
    status: string;
    leadName: string;
  };
  fileTypeDistribution: Array<{
    type: string;
    label: string;
    count: number;
    sizeBytes: number;
    color: string;
    percentage?: number;
  }>;
  recentDocuments: ProjectDocument[];
  recentFiles?: ProjectDocument[];
  recentActivity: DocumentActivity[];
  recentShares?: Array<{
    id: number;
    documentId: number;
    shareType: string;
    permissionLevel: string;
    tokenHash?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    document: ProjectDocument;
    recipientUser?: {
      id: number;
      name: string;
      email: string;
      avatarUrl?: string | null;
    } | null;
  }>;
  storageNotice: {
    repositoryName: string | null;
    repositoryOwner?: string;
    providerOwner?: string | null;
    repositoryUrl?: string | null;
    defaultBranch?: string;
    isPrivate: boolean;
    branch?: string;
    connectionStatus?: string;
    isHealthy?: boolean;
    lastSyncAt?: string | null;
    trackedSizeBytes?: number;
    configuredLimitBytes?: number;
    note?: string;
    repoUrl?: string | null;
  };
}

export interface DocumentApprovalEntry {
  id: number;
  shareId: number;
  documentId: number;
  token?: string | null;
  shareUrl?: string | null;
  isRevoked: boolean;
  revokedAt?: string | null;
  expiresAt?: string | null;
  permission: string;
  hasPassword: boolean;
  message?: string | null;
  allowApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'declined';
  approvalActorName?: string | null;
  approvalNote?: string | null;
  approvalActedAt?: string | null;
  createdAt: string;
  createdBy?: {
    id: number;
    name: string;
    username?: string;
    avatarUrl?: string | null;
  } | null;
  document: ProjectDocument;
}

export interface DocumentListParams {
  tab?: 'all' | 'my_uploads' | 'shared' | 'recent' | 'category' | 'approvals';
  submoduleId?: number;
  categoryId?: number;
  fileType?: string;
  type?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'sizeBytes' | 'downloadCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DocumentListResponse {
  documents: ProjectDocument[];
  unlinked?: boolean;
  scopeMeta?: DocumentScopeMeta;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  categoryId?: number | null;
  tags: string[];
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export interface PublicShareInfo {
  token: string;
  requiresPassword: boolean;
  message?: string | null;
  allowApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'declined' | null;
  approvalActorName?: string | null;
  approvalNote?: string | null;
  approvalActedAt?: string | null;
  sharedByName?: string | null;
  document?: {
    id: number;
    name: string;
    fileExtension: string;
    mimeType: string;
    sizeBytes: number;
    updatedAt: string;
    uploaderName: string;
    projectName: string;
    downloadCount?: number;
  };
  permission?: 'view' | 'download';
  expiresAt?: string | null;
}

