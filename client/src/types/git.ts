export type GitProviderType = 'github' | 'gitlab';
export type GitRecordType = 'issue' | 'merge_request' | 'commit' | 'branch';
export type GitFeatureKey =
  | 'git.overview'
  | 'git.repositories'
  | 'git.issues'
  | 'git.merge_requests'
  | 'git.commits'
  | 'git.code';
export type CompositeLayout = 'tabs' | 'stacked' | 'split';

export interface GitProviderConnectionItem {
  id: number;
  projectId?: number | null;
  organizationId?: number | null;
  userId: number;
  provider: GitProviderType;
  authType: 'pat' | 'oauth';
  accountName: string;
  accountEmail?: string | null;
  avatarUrl?: string | null;
  status: 'active' | 'error' | 'expired';
  scopes?: string | null;
  maskedToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitRepositoryConnectionItem {
  id: number;
  projectId: number;
  connectionId: number;
  providerRepoId: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  webUrl: string;
  cloneUrl?: string | null;
  syncStatus: 'healthy' | 'syncing' | 'error' | 'disconnected';
  syncError?: string | null;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
  providerConnection?: {
    provider: GitProviderType;
    accountName: string;
  };
}

export interface GitNormalizedIssue {
  id: string; // canonical string ID e.g. "github:owner/repo:issue:12"
  provider: GitProviderType;
  repoFullName: string;
  repositoryId?: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: {
    name: string;
    avatarUrl?: string;
    username: string;
  };
  assignees: Array<{
    name: string;
    avatarUrl?: string;
    username: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
    description?: string;
  }>;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  webUrl: string;
  linkedDevflowRecords?: Array<{
    id: number;
    targetType: 'task' | 'requirement' | 'defect';
    targetId: number;
    title?: string;
    key?: string;
  }>;
}

export interface GitNormalizedMR {
  id: string; // canonical string ID e.g. "github:owner/repo:mr:34"
  provider: GitProviderType;
  repoFullName: string;
  repositoryId?: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'merged' | 'closed' | 'draft';
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  author: {
    name: string;
    avatarUrl?: string;
    username: string;
  };
  reviewers: Array<{
    name: string;
    avatarUrl?: string;
    username: string;
    status?: 'approved' | 'changes_requested' | 'commented' | 'pending';
  }>;
  labels: Array<{
    name: string;
    color: string;
  }>;
  checkStatus: 'success' | 'pending' | 'failed' | 'neutral';
  hasConflicts: boolean;
  canMerge: boolean;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  webUrl: string;
  diffSummary?: {
    changedFiles: number;
    additions: number;
    deletions: number;
  };
  linkedDevflowRecords?: Array<{
    id: number;
    targetType: 'task' | 'requirement' | 'defect';
    targetId: number;
    title?: string;
    key?: string;
  }>;
}

export interface GitDiffFile {
  oldPath: string;
  newPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diffContent: string;
}

export interface GitBranchSummary {
  name: string;
  commitSha: string;
  isDefault: boolean;
  protected?: boolean;
}

export interface GitTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
  mode?: string;
}

export interface GitFileContent {
  name: string;
  path: string;
  size: number;
  sha?: string;
  content: string;
  encoding: string;
  webUrl?: string;
  extension: string;
}

export interface GitCommitDetail {
  sha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  committedDate: string;
  webUrl?: string;
  mappedUser?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  } | null;
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: Array<{
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

export interface GitCommitSummary {
  sha: string;
  shortSha?: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  committedDate: string;
  webUrl?: string;
  mappedUser?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  } | null;
}

export interface GitOverviewStats {
  totalRepositories: number;
  openIssues: number;
  closedIssues: number;
  openMergeRequests: number;
  mrsAwaitingReview: number;
  approvedMrs: number;
  mergedMrs: number;
  mrsWithConflicts: number;
  recentCommitsCount: number;
}

export interface GitActivityEvent {
  id: string;
  type: 'commit' | 'issue_opened' | 'issue_closed' | 'mr_opened' | 'mr_merged' | 'mr_closed';
  title: string;
  description?: string;
  actor: {
    name: string;
    username: string;
    avatarUrl?: string;
  };
  repoFullName: string;
  timestamp: string;
  webUrl?: string;
  referenceNumber?: number;
  sha?: string;
}

export interface GitRecordLinkItem {
  id: number;
  projectId: number;
  repositoryId?: number | null;
  provider: GitProviderType;
  recordType: 'issue' | 'merge_request' | 'commit' | 'branch';
  recordNumber?: number | null;
  recordId: string;
  recordTitle?: string | null;
  recordUrl?: string | null;
  targetType: 'task' | 'requirement' | 'defect';
  targetId: number;
  createdAt: string;
  targetDetails?: {
    id: number;
    title: string;
    status?: string;
    priority?: string;
  };
}

export interface CompositeSubmoduleConfig {
  features: string[];
  summaryCards?: string[];
  layout: CompositeLayout;
  defaultTab?: string;
  defaultRepoFilter?: string;
  copyMode?: 'clone' | 'separate';
  targetSubmoduleId?: number;
}

export const GIT_SUMMARY_CARD_DEFINITIONS = [
  { id: 'total-repos', title: 'Total Repositories', icon: 'git-fork', color: '#6366F1' },
  { id: 'open-issues', title: 'Open Issues', icon: 'circle-dot', color: '#F59E0B' },
  { id: 'closed-issues', title: 'Closed Issues', icon: 'check-circle-2', color: '#10B981' },
  { id: 'open-mrs', title: 'Open Merge Requests', icon: 'git-pull-request', color: '#3B82F6' },
  { id: 'mrs-awaiting-review', title: 'MRs Awaiting Review', icon: 'clock', color: '#F97316' },
  { id: 'approved-mrs', title: 'Approved MRs', icon: 'shield-check', color: '#10B981' },
  { id: 'merged-mrs', title: 'Merged MRs', icon: 'git-merge', color: '#8B5CF6' },
  { id: 'mrs-with-conflicts', title: 'MRs With Conflicts', icon: 'alert-triangle', color: '#EF4444' },
  { id: 'recent-commits', title: 'Recent Commits', icon: 'git-commit', color: '#06B6D4' },
] as const;

export const GIT_FEATURES_REGISTRY: Array<{
  key: GitFeatureKey;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    key: 'git.overview',
    title: 'Git Overview',
    description: 'Metrics summary cards, active PRs, recent issues, and cross-repo activity stream',
    icon: 'layout-dashboard',
  },
  {
    key: 'git.repositories',
    title: 'Git Repositories',
    description: 'Connected repositories, branch status, commit logs, and synchronization health',
    icon: 'git-fork',
  },
  {
    key: 'git.issues',
    title: 'Git Issues',
    description: 'Repository issues list, creation, filters, and linking with DevFlow items',
    icon: 'circle-dot',
  },
  {
    key: 'git.merge_requests',
    title: 'Merge Requests',
    description: 'Code review workflow, diff inspection, checks, conflict detection, and merge execution',
    icon: 'git-pull-request',
  },
  {
    key: 'git.commits',
    title: 'Commits',
    description: 'Repository commit history, author timelines, SHA verification, and change inspector',
    icon: 'git-commit',
  },
  {
    key: 'git.code',
    title: 'Source Code Browser',
    description: 'Online VS Code source code viewer powered by Monaco, tree explorer, and raw view',
    icon: 'code-2',
  },
];

export interface GitMemberMapping {
  id: number;
  projectId: number;
  userId: number;
  gitUsername?: string | null;
  gitEmail?: string | null;
  gitName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    name: string;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  };
}

export interface DetectedGitAuthor {
  name: string;
  email?: string;
  username?: string;
  avatarUrl?: string;
  commitCount: number;
  latestCommitDate: string;
  mappedUserId?: number | null;
  mappedUser?: {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  } | null;
}

export interface GitMemberMappingData {
  mappings: GitMemberMapping[];
  members: Array<{
    id: number;
    name: string;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  }>;
  detectedAuthors: DetectedGitAuthor[];
  memberStats: Record<number, { commitCount: number; latestCommitDate: string | null }>;
}

