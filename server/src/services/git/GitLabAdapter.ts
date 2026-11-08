import type {
  GitProviderAdapter,
  IssueFilterOptions,
  MRFilterOptions,
  CreateIssueInput,
  UpdateIssueInput,
  CreateMRInput,
  MergeMROptions,
} from './GitProviderAdapter.js';
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

const GITLAB_API_BASE = 'https://gitlab.com/api/v4';

export class GitLabAdapter implements GitProviderAdapter {
  private apiBase: string;

  constructor(customBaseUrl?: string) {
    this.apiBase = customBaseUrl ? `${customBaseUrl.replace(/\/+$/, '')}/api/v4` : GITLAB_API_BASE;
  }

  private async request<T = any>(
    token: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.apiBase}${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('PRIVATE-TOKEN', token);
    headers.set('Accept', 'application/json');

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let errorMsg = `GitLab API error (${res.status}): ${res.statusText}`;
      try {
        const errorJson = (await res.json()) as any;
        if (errorJson.message) {
          errorMsg = typeof errorJson.message === 'string' ? errorJson.message : JSON.stringify(errorJson.message);
        } else if (errorJson.error) {
          errorMsg = errorJson.error;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  private encodeProjectId(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async verifyToken(token: string): Promise<GitProviderAccount> {
    const user = await this.request(token, '/user');
    return {
      provider: 'gitlab',
      accountName: user.username,
      accountEmail: user.email || undefined,
      avatarUrl: user.avatar_url || undefined,
      scopes: [],
    };
  }

  async listRepositories(token: string): Promise<GitRepositorySummary[]> {
    const projects = await this.request<any[]>(
      token,
      '/projects?membership=true&simple=true&per_page=100&order_by=updated_at&sort=desc'
    );

    return projects.map((p) => ({
      providerRepoId: p.id.toString(),
      name: p.name,
      fullName: p.path_with_namespace,
      owner: p.namespace?.path || p.path_with_namespace.split('/')[0],
      defaultBranch: p.default_branch || 'main',
      isPrivate: p.visibility === 'private',
      webUrl: p.web_url,
      cloneUrl: p.http_url_to_repo,
      description: p.description || '',
      openIssuesCount: p.open_issues_count || 0,
      updatedAt: p.last_activity_at,
    }));
  }

  async getRepository(token: string, owner: string, repo: string): Promise<GitRepositorySummary> {
    const pid = this.encodeProjectId(owner, repo);
    const p = await this.request<any>(token, `/projects/${pid}`);
    return {
      providerRepoId: p.id.toString(),
      name: p.name,
      fullName: p.path_with_namespace,
      owner: p.namespace?.path || owner,
      defaultBranch: p.default_branch || 'main',
      isPrivate: p.visibility === 'private',
      webUrl: p.web_url,
      cloneUrl: p.http_url_to_repo,
      description: p.description || '',
      openIssuesCount: p.open_issues_count || 0,
      updatedAt: p.last_activity_at,
    };
  }

  async listBranches(token: string, owner: string, repo: string): Promise<GitBranchSummary[]> {
    const pid = this.encodeProjectId(owner, repo);
    const branches = await this.request<any[]>(token, `/projects/${pid}/repository/branches?per_page=100`);

    return branches.map((b) => ({
      name: b.name,
      isDefault: Boolean(b.default),
      commitSha: b.commit?.id || '',
      commitMessage: b.commit?.message,
      commitAuthor: b.commit?.author_name,
      commitDate: b.commit?.committed_date,
    }));
  }

  async listCommits(
    token: string,
    owner: string,
    repo: string,
    branch?: string,
    limit = 30
  ): Promise<GitCommitSummary[]> {
    const pid = this.encodeProjectId(owner, repo);
    const query = new URLSearchParams({ per_page: limit.toString() });
    if (branch) query.set('ref_name', branch);

    const commits = await this.request<any[]>(token, `/projects/${pid}/repository/commits?${query.toString()}`);

    return commits.map((c) => ({
      sha: c.id,
      message: c.message || '',
      authorName: c.author_name || 'Unknown',
      authorEmail: c.author_email,
      authorAvatarUrl: undefined,
      committedDate: c.committed_date || new Date().toISOString(),
      webUrl: c.web_url,
    }));
  }

  async listIssues(
    token: string,
    owner: string,
    repo: string,
    options?: IssueFilterOptions
  ): Promise<GitNormalizedIssue[]> {
    const pid = this.encodeProjectId(owner, repo);
    const query = new URLSearchParams({
      state: options?.state === 'all' ? 'all' : options?.state === 'closed' ? 'closed' : 'opened',
      per_page: (options?.perPage || 50).toString(),
      page: (options?.page || 1).toString(),
      order_by: options?.sort === 'updated' ? 'updated_at' : 'created_at',
      sort: options?.direction || 'desc',
    });

    if (options?.search) query.set('search', options.search);
    if (options?.labels?.length) query.set('labels', options.labels.join(','));

    const issues = await this.request<any[]>(token, `/projects/${pid}/issues?${query.toString()}`);
    return issues.map((i) => this.normalizeIssue(owner, repo, i));
  }

  async getIssue(token: string, owner: string, repo: string, issueNumber: number): Promise<GitNormalizedIssue> {
    const pid = this.encodeProjectId(owner, repo);
    const issue = await this.request<any>(token, `/projects/${pid}/issues/${issueNumber}`);
    return this.normalizeIssue(owner, repo, issue);
  }

  async createIssue(
    token: string,
    owner: string,
    repo: string,
    data: CreateIssueInput
  ): Promise<GitNormalizedIssue> {
    const pid = this.encodeProjectId(owner, repo);
    const payload: any = {
      title: data.title,
      description: data.body,
    };
    if (data.labels?.length) payload.labels = data.labels.join(',');

    const issue = await this.request<any>(token, `/projects/${pid}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return this.normalizeIssue(owner, repo, issue);
  }

  async updateIssue(
    token: string,
    owner: string,
    repo: string,
    issueNumber: number,
    data: UpdateIssueInput
  ): Promise<GitNormalizedIssue> {
    const pid = this.encodeProjectId(owner, repo);
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.body !== undefined) payload.description = data.body;
    if (data.state !== undefined) payload.state_event = data.state === 'closed' ? 'close' : 'reopen';
    if (data.labels !== undefined) payload.labels = data.labels.join(',');

    const issue = await this.request<any>(token, `/projects/${pid}/issues/${issueNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return this.normalizeIssue(owner, repo, issue);
  }

  async listMergeRequests(
    token: string,
    owner: string,
    repo: string,
    options?: MRFilterOptions
  ): Promise<GitNormalizedMR[]> {
    const pid = this.encodeProjectId(owner, repo);
    let stateParam = 'opened';
    if (options?.state === 'merged') stateParam = 'merged';
    else if (options?.state === 'closed') stateParam = 'closed';
    else if (options?.state === 'all') stateParam = 'all';

    const query = new URLSearchParams({
      state: stateParam,
      per_page: (options?.perPage || 50).toString(),
      page: (options?.page || 1).toString(),
      order_by: options?.sort === 'updated' ? 'updated_at' : 'created_at',
      sort: options?.direction || 'desc',
    });

    const mrs = await this.request<any[]>(token, `/projects/${pid}/merge_requests?${query.toString()}`);
    return mrs.map((m) => this.normalizeMR(owner, repo, m));
  }

  async getMergeRequest(token: string, owner: string, repo: string, mrNumber: number): Promise<GitNormalizedMR> {
    const pid = this.encodeProjectId(owner, repo);
    const mr = await this.request<any>(token, `/projects/${pid}/merge_requests/${mrNumber}`);
    return this.normalizeMR(owner, repo, mr);
  }

  async getMergeRequestDiff(
    token: string,
    owner: string,
    repo: string,
    mrNumber: number
  ): Promise<GitDiffFile[]> {
    const pid = this.encodeProjectId(owner, repo);
    const diffs = await this.request<any[]>(token, `/projects/${pid}/merge_requests/${mrNumber}/diffs`);

    return (diffs || []).map((d) => {
      let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
      if (d.new_file) status = 'added';
      else if (d.deleted_file) status = 'deleted';
      else if (d.renamed_file) status = 'renamed';

      const diffLines = (d.diff || '').split('\n');
      let additions = 0;
      let deletions = 0;
      for (const line of diffLines) {
        if (line.startsWith('+') && !line.startsWith('+++')) additions++;
        else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
      }

      return {
        oldPath: d.old_path,
        newPath: d.new_path,
        status,
        additions,
        deletions,
        diffContent: d.diff || '',
      };
    });
  }

  async createMergeRequest(
    token: string,
    owner: string,
    repo: string,
    data: CreateMRInput
  ): Promise<GitNormalizedMR> {
    const pid = this.encodeProjectId(owner, repo);
    const payload = {
      title: data.draft ? `Draft: ${data.title}` : data.title,
      description: data.body,
      source_branch: data.sourceBranch,
      target_branch: data.targetBranch,
    };

    const mr = await this.request<any>(token, `/projects/${pid}/merge_requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return this.normalizeMR(owner, repo, mr);
  }

  async mergeMergeRequest(
    token: string,
    owner: string,
    repo: string,
    mrNumber: number,
    options: MergeMROptions
  ): Promise<{ success: boolean; sha?: string; message: string }> {
    const pid = this.encodeProjectId(owner, repo);
    const payload: any = {};
    if (options.commitMessage) payload.merge_commit_message = options.commitMessage;
    if (options.deleteSourceBranch) payload.should_remove_source_branch = true;
    if (options.mergeMethod === 'squash') payload.squash = true;

    const res = await this.request<any>(token, `/projects/${pid}/merge_requests/${mrNumber}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      success: res.state === 'merged',
      sha: res.merge_commit_sha,
      message: res.state === 'merged' ? 'Merge request merged successfully' : 'Merge request processed',
    };
  }

  async getCommit(token: string, owner: string, repo: string, sha: string): Promise<GitCommitDetail> {
    const pid = this.encodeProjectId(owner, repo);
    const commit = await this.request<any>(token, `/projects/${pid}/repository/commits/${sha}`);
    let diffs: any[] = [];
    try {
      diffs = await this.request<any[]>(token, `/projects/${pid}/repository/commits/${sha}/diff`);
    } catch {
      // ignore diff error if unavailable
    }

    return {
      sha: commit.id,
      message: commit.message || '',
      authorName: commit.author_name || 'Unknown',
      authorEmail: commit.author_email,
      committedDate: commit.committed_date || commit.created_at || new Date().toISOString(),
      webUrl: commit.web_url,
      stats: commit.stats
        ? {
            total: commit.stats.total || 0,
            additions: commit.stats.additions || 0,
            deletions: commit.stats.deletions || 0,
          }
        : undefined,
      files: (diffs || []).map((d: any) => ({
        filename: d.new_path || d.old_path,
        status: (d.new_file ? 'added' : d.deleted_file ? 'removed' : d.renamed_file ? 'renamed' : 'modified') as 'added' | 'modified' | 'renamed' | 'removed',
        additions: 0,
        deletions: 0,
        patch: d.diff,
      })),
    };
  }

  async getTree(token: string, owner: string, repo: string, path = '', ref?: string): Promise<GitTreeItem[]> {
    const pid = this.encodeProjectId(owner, repo);
    const query = new URLSearchParams();
    if (ref) query.set('ref', ref);
    if (path) query.set('path', path.replace(/^\/+|\/+$/g, ''));
    query.set('per_page', '100');

    const items = await this.request<any[]>(token, `/projects/${pid}/repository/tree?${query.toString()}`);
    return (items || [])
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'tree' ? ('dir' as const) : ('file' as const),
        sha: item.id,
        mode: item.mode,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  async getFileContent(token: string, owner: string, repo: string, path: string, ref?: string): Promise<GitFileContent> {
    const pid = this.encodeProjectId(owner, repo);
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const encodedPath = encodeURIComponent(cleanPath);
    const query = new URLSearchParams();
    if (ref) query.set('ref', ref);

    const file = await this.request<any>(token, `/projects/${pid}/repository/files/${encodedPath}?${query.toString()}`);
    let content = '';
    if (file.encoding === 'base64' && file.content) {
      content = Buffer.from(file.content, 'base64').toString('utf-8');
    } else if (file.content) {
      content = file.content;
    }

    const extension = cleanPath.split('.').pop() || '';
    return {
      name: file.file_name || cleanPath.split('/').pop() || '',
      path: file.file_path || cleanPath,
      size: file.size || 0,
      sha: file.blob_id,
      content,
      encoding: 'utf-8',
      webUrl: `${this.apiBase.replace('/api/v4', '')}/${owner}/${repo}/-/blob/${ref || 'main'}/${cleanPath}`,
      extension,
    };
  }

  private normalizeIssue(owner: string, repo: string, i: any): GitNormalizedIssue {
    const repoFullName = `${owner}/${repo}`;
    return {
      id: `gitlab:${repoFullName}:issue:${i.iid}`,
      provider: 'gitlab',
      repoFullName,
      number: i.iid,
      title: i.title,
      body: i.description || '',
      state: i.state === 'closed' ? 'closed' : 'open',
      author: {
        name: i.author?.name || i.author?.username || 'User',
        username: i.author?.username || 'user',
        avatarUrl: i.author?.avatar_url,
      },
      assignees: (i.assignees || []).map((a: any) => ({
        name: a.name || a.username,
        username: a.username,
        avatarUrl: a.avatar_url,
      })),
      labels: (i.labels || []).map((l: string) => ({
        name: l,
        color: '#6B7280',
      })),
      commentsCount: i.user_notes_count || 0,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      closedAt: i.closed_at || undefined,
      webUrl: i.web_url,
    };
  }

  private normalizeMR(owner: string, repo: string, m: any): GitNormalizedMR {
    const repoFullName = `${owner}/${repo}`;
    let state: 'open' | 'merged' | 'closed' | 'draft' = 'open';
    if (m.state === 'merged') state = 'merged';
    else if (m.state === 'closed') state = 'closed';
    else if (m.work_in_progress || m.draft) state = 'draft';

    const hasConflicts = Boolean(m.has_conflicts);

    return {
      id: `gitlab:${repoFullName}:mr:${m.iid}`,
      provider: 'gitlab',
      repoFullName,
      number: m.iid,
      title: m.title,
      body: m.description || '',
      state,
      isDraft: Boolean(m.work_in_progress || m.draft),
      sourceBranch: m.source_branch || '',
      targetBranch: m.target_branch || '',
      author: {
        name: m.author?.name || m.author?.username || 'User',
        username: m.author?.username || 'user',
        avatarUrl: m.author?.avatar_url,
      },
      reviewers: (m.reviewers || []).map((r: any) => ({
        name: r.name || r.username,
        username: r.username,
        avatarUrl: r.avatar_url,
        status: 'pending',
      })),
      labels: (m.labels || []).map((l: string) => ({
        name: l,
        color: '#6B7280',
      })),
      checkStatus: m.head_pipeline?.status === 'success' ? 'success' : m.head_pipeline?.status === 'failed' ? 'failed' : 'neutral',
      hasConflicts,
      canMerge: !hasConflicts && state === 'open' && m.merge_status === 'can_be_merged',
      commentsCount: m.user_notes_count || 0,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      mergedAt: m.merged_at || undefined,
      closedAt: m.closed_at || undefined,
      webUrl: m.web_url,
    };
  }
}

