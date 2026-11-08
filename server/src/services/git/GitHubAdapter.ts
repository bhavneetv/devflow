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

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubAdapter implements GitProviderAdapter {
  private async request<T = any>(
    token: string,
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Accept', headers.get('Accept') || 'application/vnd.github.v3+json');
    headers.set('User-Agent', 'DevFlow-App');

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let errorMsg = `GitHub API error (${res.status}): ${res.statusText}`;
      try {
        const errorJson = (await res.json()) as any;
        if (errorJson.message) {
          errorMsg = errorJson.message;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json() as Promise<T>;
    }
    return res.text() as unknown as Promise<T>;
  }

  async verifyToken(token: string): Promise<GitProviderAccount> {
    const user = await this.request(token, '/user');
    return {
      provider: 'github',
      accountName: user.login,
      accountEmail: user.email || undefined,
      avatarUrl: user.avatar_url || undefined,
      scopes: [],
    };
  }

  async listRepositories(token: string): Promise<GitRepositorySummary[]> {
    const repos = await this.request<any[]>(
      token,
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member'
    );

    return repos.map((r) => ({
      providerRepoId: r.id.toString(),
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || '',
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      webUrl: r.html_url,
      cloneUrl: r.clone_url,
      description: r.description || '',
      openIssuesCount: r.open_issues_count || 0,
      updatedAt: r.updated_at,
    }));
  }

  async getRepository(token: string, owner: string, repo: string): Promise<GitRepositorySummary> {
    const r = await this.request<any>(token, `/repos/${owner}/${repo}`);
    return {
      providerRepoId: r.id.toString(),
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || '',
      defaultBranch: r.default_branch || 'main',
      isPrivate: Boolean(r.private),
      webUrl: r.html_url,
      cloneUrl: r.clone_url,
      description: r.description || '',
      openIssuesCount: r.open_issues_count || 0,
      updatedAt: r.updated_at,
    };
  }

  async listBranches(token: string, owner: string, repo: string): Promise<GitBranchSummary[]> {
    const branches = await this.request<any[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
    const repository = await this.getRepository(token, owner, repo).catch(() => null);

    return branches.map((b) => ({
      name: b.name,
      isDefault: repository ? repository.defaultBranch === b.name : b.name === 'main' || b.name === 'master',
      commitSha: b.commit?.sha || '',
    }));
  }

  async listCommits(
    token: string,
    owner: string,
    repo: string,
    branch?: string,
    limit = 30
  ): Promise<GitCommitSummary[]> {
    const query = new URLSearchParams({ per_page: limit.toString() });
    if (branch) query.set('sha', branch);

    const commits = await this.request<any[]>(token, `/repos/${owner}/${repo}/commits?${query.toString()}`);

    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit?.message || '',
      authorName: c.commit?.author?.name || c.author?.login || 'Unknown',
      authorEmail: c.commit?.author?.email,
      authorAvatarUrl: c.author?.avatar_url,
      committedDate: c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString(),
      webUrl: c.html_url,
    }));
  }

  async listIssues(
    token: string,
    owner: string,
    repo: string,
    options?: IssueFilterOptions
  ): Promise<GitNormalizedIssue[]> {
    const query = new URLSearchParams({
      state: options?.state || 'open',
      per_page: (options?.perPage || 50).toString(),
      page: (options?.page || 1).toString(),
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
    });

    if (options?.assignee) query.set('assignee', options.assignee);
    if (options?.author) query.set('creator', options.author);
    if (options?.labels && options.labels.length > 0) query.set('labels', options.labels.join(','));

    const items = await this.request<any[]>(token, `/repos/${owner}/${repo}/issues?${query.toString()}`);

    // In GitHub API, PRs are also returned under /issues. Filter out PRs:
    const pureIssues = items.filter((i) => !i.pull_request);

    return pureIssues.map((i) => this.normalizeIssue(owner, repo, i));
  }

  async getIssue(token: string, owner: string, repo: string, issueNumber: number): Promise<GitNormalizedIssue> {
    const issue = await this.request<any>(token, `/repos/${owner}/${repo}/issues/${issueNumber}`);
    return this.normalizeIssue(owner, repo, issue);
  }

  async createIssue(
    token: string,
    owner: string,
    repo: string,
    data: CreateIssueInput
  ): Promise<GitNormalizedIssue> {
    const payload: any = {
      title: data.title,
      body: data.body,
    };
    if (data.assignees?.length) payload.assignees = data.assignees;
    if (data.labels?.length) payload.labels = data.labels;

    const issue = await this.request<any>(token, `/repos/${owner}/${repo}/issues`, {
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
    const payload: any = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.body !== undefined) payload.body = data.body;
    if (data.state !== undefined) payload.state = data.state;
    if (data.assignees !== undefined) payload.assignees = data.assignees;
    if (data.labels !== undefined) payload.labels = data.labels;

    const issue = await this.request<any>(token, `/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
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
    const query = new URLSearchParams({
      state: options?.state === 'merged' ? 'closed' : options?.state || 'open',
      per_page: (options?.perPage || 50).toString(),
      page: (options?.page || 1).toString(),
      sort: options?.sort || 'created',
      direction: options?.direction || 'desc',
    });

    const pulls = await this.request<any[]>(token, `/repos/${owner}/${repo}/pulls?${query.toString()}`);

    let filtered = pulls;
    if (options?.state === 'merged') {
      filtered = pulls.filter((p) => Boolean(p.merged_at));
    }

    return filtered.map((p) => this.normalizeMR(owner, repo, p));
  }

  async getMergeRequest(token: string, owner: string, repo: string, mrNumber: number): Promise<GitNormalizedMR> {
    const pull = await this.request<any>(token, `/repos/${owner}/${repo}/pulls/${mrNumber}`);

    // Fetch review statuses and check runs in parallel
    const [reviews, checkRuns] = await Promise.all([
      this.request<any[]>(token, `/repos/${owner}/${repo}/pulls/${mrNumber}/reviews`).catch(() => []),
      this.request<any>(token, `/repos/${owner}/${repo}/commits/${pull.head.sha}/check-runs`).catch(() => ({
        check_runs: [],
      })),
    ]);

    const normalized = this.normalizeMR(owner, repo, pull);

    // Map reviewers from reviews
    if (Array.isArray(reviews)) {
      normalized.reviewers = reviews.map((r) => ({
        name: r.user?.login || 'Reviewer',
        username: r.user?.login || 'reviewer',
        avatarUrl: r.user?.avatar_url,
        status:
          r.state === 'APPROVED'
            ? 'approved'
            : r.state === 'CHANGES_REQUESTED'
            ? 'changes_requested'
            : 'commented',
      }));
    }

    // Determine check runs status
    if (checkRuns?.check_runs && checkRuns.check_runs.length > 0) {
      const anyFailed = checkRuns.check_runs.some(
        (c: any) => c.conclusion === 'failure' || c.conclusion === 'timed_out'
      );
      const anyPending = checkRuns.check_runs.some((c: any) => c.status === 'in_progress' || c.status === 'queued');
      if (anyFailed) {
        normalized.checkStatus = 'failed';
      } else if (anyPending) {
        normalized.checkStatus = 'pending';
      } else {
        normalized.checkStatus = 'success';
      }
    }

    // Check conflict status
    if (pull.mergeable === false) {
      normalized.hasConflicts = true;
      normalized.canMerge = false;
    } else if (pull.mergeable === true) {
      normalized.hasConflicts = false;
      normalized.canMerge = true;
    }

    return normalized;
  }

  async getMergeRequestDiff(
    token: string,
    owner: string,
    repo: string,
    mrNumber: number
  ): Promise<GitDiffFile[]> {
    const rawDiff = await this.request<string>(token, `/repos/${owner}/${repo}/pulls/${mrNumber}`, {
      headers: {
        Accept: 'application/vnd.github.v3.diff',
      },
    });

    return parseRawUnifiedDiff(rawDiff);
  }

  async createMergeRequest(
    token: string,
    owner: string,
    repo: string,
    data: CreateMRInput
  ): Promise<GitNormalizedMR> {
    const payload = {
      title: data.title,
      body: data.body,
      head: data.sourceBranch,
      base: data.targetBranch,
      draft: Boolean(data.draft),
    };

    const pull = await this.request<any>(token, `/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return this.normalizeMR(owner, repo, pull);
  }

  async mergeMergeRequest(
    token: string,
    owner: string,
    repo: string,
    mrNumber: number,
    options: MergeMROptions
  ): Promise<{ success: boolean; sha?: string; message: string }> {
    const payload: any = {
      merge_method: options.mergeMethod || 'merge',
    };
    if (options.commitTitle) payload.commit_title = options.commitTitle;
    if (options.commitMessage) payload.commit_message = options.commitMessage;

    const res = await this.request<any>(token, `/repos/${owner}/${repo}/pulls/${mrNumber}/merge`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return {
      success: Boolean(res.merged),
      sha: res.sha,
      message: res.message || 'Pull request successfully merged',
    };
  }

  private normalizeIssue(owner: string, repo: string, i: any): GitNormalizedIssue {
    const repoFullName = `${owner}/${repo}`;
    return {
      id: `github:${repoFullName}:issue:${i.number}`,
      provider: 'github',
      repoFullName,
      number: i.number,
      title: i.title,
      body: i.body || '',
      state: i.state === 'closed' ? 'closed' : 'open',
      author: {
        name: i.user?.login || 'User',
        username: i.user?.login || 'user',
        avatarUrl: i.user?.avatar_url,
      },
      assignees: (i.assignees || []).map((a: any) => ({
        name: a.login,
        username: a.login,
        avatarUrl: a.avatar_url,
      })),
      labels: (i.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'string' ? '#6B7280' : `#${l.color}`,
        description: l.description,
      })),
      commentsCount: i.comments || 0,
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      closedAt: i.closed_at || undefined,
      webUrl: i.html_url,
    };
  }

  private normalizeMR(owner: string, repo: string, p: any): GitNormalizedMR {
    const repoFullName = `${owner}/${repo}`;
    let state: 'open' | 'merged' | 'closed' | 'draft' = 'open';
    if (p.merged_at) {
      state = 'merged';
    } else if (p.state === 'closed') {
      state = 'closed';
    } else if (p.draft) {
      state = 'draft';
    }

    return {
      id: `github:${repoFullName}:mr:${p.number}`,
      provider: 'github',
      repoFullName,
      number: p.number,
      title: p.title,
      body: p.body || '',
      state,
      isDraft: Boolean(p.draft),
      sourceBranch: p.head?.ref || '',
      targetBranch: p.base?.ref || '',
      author: {
        name: p.user?.login || 'User',
        username: p.user?.login || 'user',
        avatarUrl: p.user?.avatar_url,
      },
      reviewers: (p.requested_reviewers || []).map((r: any) => ({
        name: r.login,
        username: r.login,
        avatarUrl: r.avatar_url,
        status: 'pending',
      })),
      labels: (p.labels || []).map((l: any) => ({
        name: typeof l === 'string' ? l : l.name,
        color: typeof l === 'string' ? '#6B7280' : `#${l.color}`,
      })),
      checkStatus: 'neutral',
      hasConflicts: p.mergeable === false,
      canMerge: p.mergeable !== false && !p.merged_at && p.state === 'open',
      commentsCount: p.comments || 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      mergedAt: p.merged_at || undefined,
      closedAt: p.closed_at || undefined,
      webUrl: p.html_url,
      diffSummary: {
        changedFiles: p.changed_files || 0,
        additions: p.additions || 0,
        deletions: p.deletions || 0,
      },
    };
  }

  async getCommit(token: string, owner: string, repo: string, sha: string): Promise<GitCommitDetail> {
    const c = await this.request<any>(token, `/repos/${owner}/${repo}/commits/${sha}`);
    return {
      sha: c.sha,
      message: c.commit?.message || '',
      authorName: c.commit?.author?.name || c.author?.login || 'Unknown',
      authorEmail: c.commit?.author?.email,
      authorAvatarUrl: c.author?.avatar_url,
      committedDate: c.commit?.author?.date || c.commit?.committer?.date || new Date().toISOString(),
      webUrl: c.html_url,
      stats: c.stats
        ? {
            total: c.stats.total || 0,
            additions: c.stats.additions || 0,
            deletions: c.stats.deletions || 0,
          }
        : undefined,
      files: (c.files || []).map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions || 0,
        deletions: f.deletions || 0,
        patch: f.patch,
      })),
    };
  }

  async getTree(token: string, owner: string, repo: string, path = '', ref?: string): Promise<GitTreeItem[]> {
    const query = new URLSearchParams();
    if (ref) query.set('ref', ref);
    const cleanPath = path ? path.replace(/^\/+|\/+$/g, '') : '';
    const endpoint = cleanPath
      ? `/repos/${owner}/${repo}/contents/${cleanPath}${query.toString() ? `?${query.toString()}` : ''}`
      : `/repos/${owner}/${repo}/contents${query.toString() ? `?${query.toString()}` : ''}`;

    const items = await this.request<any[] | any>(token, endpoint);
    if (!Array.isArray(items)) {
      return [
        {
          name: items.name,
          path: items.path,
          type: items.type === 'dir' ? 'dir' : 'file',
          size: items.size,
          sha: items.sha,
        },
      ];
    }

    return items
      .map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? ('dir' as const) : ('file' as const),
        size: item.size,
        sha: item.sha,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  async getFileContent(token: string, owner: string, repo: string, path: string, ref?: string): Promise<GitFileContent> {
    const query = new URLSearchParams();
    if (ref) query.set('ref', ref);
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const endpoint = `/repos/${owner}/${repo}/contents/${cleanPath}${query.toString() ? `?${query.toString()}` : ''}`;

    const item = await this.request<any>(token, endpoint);
    let content = '';
    if (item.encoding === 'base64' && item.content) {
      content = Buffer.from(item.content, 'base64').toString('utf-8');
    } else if (item.content) {
      content = item.content;
    }

    const extension = cleanPath.split('.').pop() || '';

    return {
      name: item.name,
      path: item.path,
      size: item.size || 0,
      sha: item.sha,
      content,
      encoding: 'utf-8',
      webUrl: item.html_url,
      extension,
    };
  }
}

/**
 * Parses raw git unified diff into structured GitDiffFile array
 */
export function parseRawUnifiedDiff(rawDiff: string): GitDiffFile[] {
  if (!rawDiff || typeof rawDiff !== 'string') return [];

  const files: GitDiffFile[] = [];
  const fileBlocks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    const headerLine = lines[0] || '';
    // Format: a/path/to/file b/path/to/file
    const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/);
    const oldPath = match ? match[1] : '';
    const newPath = match ? match[2] : '';

    let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
    if (block.includes('new file mode')) {
      status = 'added';
    } else if (block.includes('deleted file mode')) {
      status = 'deleted';
    } else if (block.includes('similarity index')) {
      status = 'renamed';
    }

    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    files.push({
      oldPath: oldPath || newPath,
      newPath: newPath || oldPath,
      status,
      additions,
      deletions,
      diffContent: lines.slice(1).join('\n'),
    });
  }

  return files;
}

