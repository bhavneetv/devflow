import type {
  GitProviderAccount,
  GitRepositorySummary,
  GitBranchSummary,
  GitCommitSummary,
  GitNormalizedIssue,
  GitNormalizedMR,
  GitDiffFile,
  GitTreeItem,
  GitFileContent,
  GitCommitDetail,
} from './git.types.js';

export interface IssueFilterOptions {
  state?: 'open' | 'closed' | 'all';
  search?: string;
  assignee?: string;
  author?: string;
  labels?: string[];
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface MRFilterOptions {
  state?: 'open' | 'closed' | 'merged' | 'all';
  search?: string;
  assignee?: string;
  author?: string;
  labels?: string[];
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface CreateIssueInput {
  title: string;
  body: string;
  assignees?: string[];
  labels?: string[];
}

export interface UpdateIssueInput {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  assignees?: string[];
  labels?: string[];
}

export interface CreateMRInput {
  title: string;
  body: string;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
}

export interface MergeMROptions {
  commitTitle?: string;
  commitMessage?: string;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  deleteSourceBranch?: boolean;
}

export interface GitProviderAdapter {
  verifyToken(token: string): Promise<GitProviderAccount>;
  listRepositories(token: string): Promise<GitRepositorySummary[]>;
  getRepository(token: string, owner: string, repo: string): Promise<GitRepositorySummary>;
  listBranches(token: string, owner: string, repo: string): Promise<GitBranchSummary[]>;
  listCommits(token: string, owner: string, repo: string, branch?: string, limit?: number): Promise<GitCommitSummary[]>;
  listIssues(token: string, owner: string, repo: string, options?: IssueFilterOptions): Promise<GitNormalizedIssue[]>;
  getIssue(token: string, owner: string, repo: string, issueNumber: number): Promise<GitNormalizedIssue>;
  createIssue(token: string, owner: string, repo: string, data: CreateIssueInput): Promise<GitNormalizedIssue>;
  updateIssue(token: string, owner: string, repo: string, issueNumber: number, data: UpdateIssueInput): Promise<GitNormalizedIssue>;
  listMergeRequests(token: string, owner: string, repo: string, options?: MRFilterOptions): Promise<GitNormalizedMR[]>;
  getMergeRequest(token: string, owner: string, repo: string, mrNumber: number): Promise<GitNormalizedMR>;
  getMergeRequestDiff(token: string, owner: string, repo: string, mrNumber: number): Promise<GitDiffFile[]>;
  createMergeRequest(token: string, owner: string, repo: string, data: CreateMRInput): Promise<GitNormalizedMR>;
  mergeMergeRequest(
    token: string,
    owner: string,
    repo: string,
    mrNumber: number,
    options: MergeMROptions
  ): Promise<{ success: boolean; sha?: string; message: string }>;
  getCommit(token: string, owner: string, repo: string, sha: string): Promise<GitCommitDetail>;
  getTree(token: string, owner: string, repo: string, path?: string, ref?: string): Promise<GitTreeItem[]>;
  getFileContent(token: string, owner: string, repo: string, path: string, ref?: string): Promise<GitFileContent>;
}

