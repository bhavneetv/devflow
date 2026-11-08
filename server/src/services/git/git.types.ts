export type GitProviderType = 'github' | 'gitlab';

export interface GitProviderAccount {
  accountName: string;
  accountEmail?: string;
  avatarUrl?: string;
  scopes?: string[];
  provider: GitProviderType;
}

export interface GitRepositorySummary {
  providerRepoId: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  webUrl: string;
  cloneUrl?: string;
  description?: string;
  openIssuesCount?: number;
  openPullRequestsCount?: number;
  updatedAt?: string;
}

export interface GitBranchSummary {
  name: string;
  isDefault: boolean;
  commitSha: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
}

export interface GitCommitSummary {
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
    username?: string | null;
    avatarUrl?: string | null;
    avatarColor?: string | null;
    role?: string;
  } | null;
}

export interface GitNormalizedIssue {
  id: string; // canonical string ID e.g. "github:bhavneetv/devflow:issue:12"
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
  }>;
}

export interface GitNormalizedMR {
  id: string; // canonical string ID e.g. "github:bhavneetv/devflow:mr:34"
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

export interface GitTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha: string;
}

export interface GitFileContent {
  name: string;
  path: string;
  size: number;
  sha: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  webUrl?: string;
  extension?: string;
}

export interface GitCommitDetail extends GitCommitSummary {
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

export interface GitMemberMappingRecord {
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
  } | null;
}


