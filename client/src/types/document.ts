export interface ProjectDocument {
  id: number;
  projectId: number;
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
  shareType: 'internal' | 'public';
  permission: 'view' | 'download';
  sharedWithUserId?: number | null;
  sharedWithTeamId?: number | null;
  token?: string | null;
  hasPassword?: boolean;
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

export interface DocumentDashboardData {
  metrics: {
    totalDocuments: number;
    totalFiles?: number;
    totalSize: number;
    totalSizeBytes?: number;
    documentsUploadedThisMonth: number;
    activeShares: number;
    sharedCount?: number;
    internalShares: number;
    externalShares: number;
    totalDownloads: number;
    categoryCount: number;
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
  fileTypeDistribution: Array<{
    type: string;
    label: string;
    count: number;
    sizeBytes: number;
    color: string;
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
    repositoryName: string;
    repositoryOwner: string;
    isPrivate: boolean;
    branch: string;
    note: string;
    repoUrl?: string | null;
  };
}

export interface DocumentListParams {
  tab?: 'all' | 'my_uploads' | 'shared' | 'recent' | 'category';
  categoryId?: number;
  fileType?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'sizeBytes' | 'downloadCount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DocumentListResponse {
  documents: ProjectDocument[];
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
  document?: {
    id: number;
    name: string;
    fileExtension: string;
    mimeType: string;
    sizeBytes: number;
    updatedAt: string;
    uploaderName: string;
    projectName: string;
    downloadCount: number;
  };
  permission?: 'view' | 'download';
  expiresAt?: string | null;
}

