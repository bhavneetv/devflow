import { decryptSecret } from '../../lib/crypto.js';
import { prisma } from '../../lib/prisma.js';

const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubRepoCreateResult {
  repoId: string;
  name: string;
  fullName: string;
  owner: string;
  webUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export interface GitHubFileUploadResult {
  sha: string;
  commitSha: string;
  path: string;
  size: number;
  branch: string;
}

export interface GitHubBranchStat {
  name: string;
  commitSha: string;
  isDefault: boolean;
  protected: boolean;
  gitHubTreeBytes: number | null;
  gitHubBlobCount: number | null;
}

export interface GitHubFileContentResult {
  buffer: Buffer;
  contentType: string;
  size: number;
  sha: string;
}

export class GitHubDocumentStorageService {
  /**
   * Helper to make authenticated requests to GitHub API
   */
  private static async request<T = any>(
    token: string,
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; status: number; headers: Headers }> {
    const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('User-Agent', 'DevFlow-Documents-Module');

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/vnd.github.v3+json');
    }

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
      const error: any = new Error(errorMsg);
      error.status = res.status;
      throw error;
    }

    if (res.status === 204) {
      return { data: {} as T, status: res.status, headers: res.headers };
    }

    const acceptHeader = headers.get('Accept') || '';
    if (acceptHeader.includes('application/vnd.github.v3.raw')) {
      const arrayBuffer = await res.arrayBuffer();
      return { data: Buffer.from(arrayBuffer) as unknown as T, status: res.status, headers: res.headers };
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as T;
      return { data, status: res.status, headers: res.headers };
    }

    const text = (await res.text()) as unknown as T;
    return { data: text, status: res.status, headers: res.headers };
  }

  /**
   * Resolves a valid GitHub token and account info for a project.
   * Prioritizes project's GitProviderConnection, then .env GITHUB_TOKEN fallback.
   */
  public static async resolveGitHubCredentials(projectId: number): Promise<{
    token: string;
    owner: string;
    connectionId?: number;
    accountId?: string;
  }> {
    // 1. Try to find active GitHub connection for this project
    const connection = await (prisma as any).gitProviderConnection.findFirst({
      where: {
        projectId,
        provider: 'github',
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (connection && connection.tokenEncrypted) {
      try {
        const token = decryptSecret(
          connection.tokenEncrypted,
          connection.tokenIv,
          connection.tokenTag
        );
        return {
          token,
          owner: connection.accountName,
          connectionId: connection.id,
          accountId: connection.accountName,
        };
      } catch (err) {
        console.warn('Failed to decrypt project gitProviderConnection token:', err);
      }
    }

    // 2. Fallback to process.env.GITHUB_TOKEN
    const envToken = process.env.GITHUB_TOKEN?.trim();
    if (envToken && envToken.length > 5) {
      try {
        const { data: user } = await this.request<any>(envToken, '/user');
        return {
          token: envToken,
          owner: user.login,
          accountId: user.login,
        };
      } catch (err: any) {
        throw new Error(`Configured server GITHUB_TOKEN is invalid or expired: ${err.message}`);
      }
    }

    throw new Error(
      'No GitHub account connected for this project. Please connect your GitHub account in Project Settings > Git Connections or configure GITHUB_TOKEN in server/.env.'
    );
  }

  /**
   * Sanitizes a slug for GitHub repository naming
   */
  public static sanitizeSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'project';
  }

  /**
   * Ensures a dedicated private document repository exists for the project.
   * Naming convention: devflow-{projectSlug}-docs
   * If taken, tries devflow-{projectSlug}-docs-1, devflow-{projectSlug}-docs-2, etc.
   */
  public static async ensureDocumentRepository(
    projectId: number,
    projectTitle: string
  ): Promise<GitHubRepoCreateResult> {
    const { token, owner, connectionId, accountId } = await this.resolveGitHubCredentials(projectId);
    const slug = this.sanitizeSlug(projectTitle);
    const baseRepoName = `devflow-${slug}-docs`;

    // Check if project already has a configured storage connection
    const existingConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });

    if (existingConn && existingConn.connectionStatus === 'unlinked') {
      throw new Error(
        `Storage repository (${existingConn.providerOwner}/${existingConn.repositoryName}) is currently unlinked. Relink it in Project Settings > Storage to access or upload documents.`
      );
    }

    if (existingConn && existingConn.repositoryName) {
      // Verify repository still exists on GitHub
      try {
        const { data: repo } = await this.request<any>(
          token,
          `/repos/${existingConn.providerOwner}/${existingConn.repositoryName}`
        );
        return {
          repoId: repo.id.toString(),
          name: repo.name,
          fullName: repo.full_name,
          owner: repo.owner.login,
          webUrl: repo.html_url,
          defaultBranch: repo.default_branch || 'main',
          isPrivate: Boolean(repo.private),
        };
      } catch (err: any) {
        if (err.status !== 404) {
          throw err;
        }
        // If 404, repository was deleted on GitHub; proceed to recreate or rebind
      }
    }

    // Try finding or creating repo with suffix handling: devflow-slug-docs, -1, -2, etc.
    let candidateName = baseRepoName;
    let suffix = 0;
    let createdRepo: any = null;

    while (!createdRepo && suffix <= 50) {
      try {
        // Check if repo exists and is owned by user
        const { data: existingRepo } = await this.request<any>(
          token,
          `/repos/${owner}/${candidateName}`
        );
        createdRepo = existingRepo;
        break;
      } catch (err: any) {
        if (err.status === 404) {
          // Repo does not exist, attempt to create it as PRIVATE
          try {
            const { data: newRepo } = await this.request<any>(token, '/user/repos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: candidateName,
                description: `DevFlow Project Documents Storage [Private] for "${projectTitle}"`,
                private: true,
                auto_init: true, // creates README and initial commit so main branch exists immediately
              }),
            });
            createdRepo = newRepo;
            break;
          } catch (createErr: any) {
            // If already exists or naming conflict, increment suffix
            if (createErr.status === 422) {
              suffix++;
              candidateName = `${baseRepoName}-${suffix}`;
              continue;
            }
            throw createErr;
          }
        } else {
          throw err;
        }
      }
    }

    if (!createdRepo) {
      throw new Error(`Failed to create or locate a document repository for project ${projectTitle}.`);
    }

    // Upsert the projectStorageConnection record in DevFlow database
    await (prisma as any).projectStorageConnection.upsert({
      where: { projectId },
      update: {
        provider: 'github',
        providerAccountId: accountId || owner,
        providerOwner: createdRepo.owner?.login || owner,
        providerRepoId: createdRepo.id.toString(),
        repositoryName: createdRepo.name,
        repositoryUrl: createdRepo.html_url,
        defaultBranch: createdRepo.default_branch || 'main',
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
        providerConnectionId: connectionId || null,
      },
      create: {
        projectId,
        provider: 'github',
        providerAccountId: accountId || owner,
        providerOwner: createdRepo.owner?.login || owner,
        providerRepoId: createdRepo.id.toString(),
        repositoryName: createdRepo.name,
        repositoryUrl: createdRepo.html_url,
        defaultBranch: createdRepo.default_branch || 'main',
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
        providerConnectionId: connectionId || null,
      },
    });

    return {
      repoId: createdRepo.id.toString(),
      name: createdRepo.name,
      fullName: createdRepo.full_name,
      owner: createdRepo.owner?.login || owner,
      webUrl: createdRepo.html_url,
      defaultBranch: createdRepo.default_branch || 'main',
      isPrivate: Boolean(createdRepo.private),
    };
  }

  /**
   * Ensures a branch exists in the GitHub repository, creating it from baseBranch if missing.
   */
  public static async ensureBranchExists(
    token: string,
    owner: string,
    repoName: string,
    branchName: string,
    baseBranch: string
  ): Promise<void> {
    const cleanBranch = branchName.trim().replace(/^refs\/heads\//, '');
    if (!cleanBranch || cleanBranch === baseBranch) return;

    try {
      await this.request(
        token,
        `/repos/${owner}/${repoName}/git/ref/heads/${encodeURIComponent(cleanBranch).replace(/%2F/g, '/')}`
      );
      return; // Branch already exists
    } catch (err: any) {
      if (err.status !== 404) {
        throw err;
      }
    }

    // Resolve SHA from base branch
    let baseSha: string | null = null;
    try {
      const { data: baseRef } = await this.request<any>(
        token,
        `/repos/${owner}/${repoName}/git/ref/heads/${encodeURIComponent(baseBranch).replace(/%2F/g, '/')}`
      );
      baseSha = baseRef?.object?.sha || null;
    } catch {
      const { data: branches } = await this.request<any[]>(token, `/repos/${owner}/${repoName}/branches?per_page=10`);
      baseSha = branches?.[0]?.commit?.sha || null;
    }

    if (!baseSha) {
      throw new Error(`Cannot create branch "${cleanBranch}" because base branch "${baseBranch}" has no commits yet.`);
    }

    await this.request(token, `/repos/${owner}/${repoName}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: `refs/heads/${cleanBranch}`,
        sha: baseSha,
      }),
    });
  }

  /**
   * Uploads or updates a file in the project's private GitHub document repository.
   */
  public static async uploadDocumentFile(params: {
    projectId: number;
    projectTitle: string;
    fileName: string;
    storageKey: string;
    categorySlug?: string;
    branchName?: string;
    pathPrefix?: string;
    contentBuffer: Buffer;
    existingSha?: string;
    uploaderName?: string;
  }): Promise<GitHubFileUploadResult> {
    const { token } = await this.resolveGitHubCredentials(params.projectId);
    const repoInfo = await this.ensureDocumentRepository(params.projectId, params.projectTitle);

    const targetBranch = (params.branchName || '').trim() || repoInfo.defaultBranch;
    if (targetBranch !== repoInfo.defaultBranch) {
      await this.ensureBranchExists(token, repoInfo.owner, repoInfo.name, targetBranch, repoInfo.defaultBranch);
    }

    // Build deterministic safe path
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const cleanPrefix = (params.pathPrefix || '').trim().replace(/^\/+|\/+$/g, '');
    const catFolder = params.categorySlug || 'documents';
    const folder = cleanPrefix
      ? `${cleanPrefix}/${catFolder}`
      : `projects/${params.projectId}/${catFolder}`;
    const repoPath = `${folder}/${params.storageKey}/${safeName}`;

    const base64Content = params.contentBuffer.toString('base64');
    const commitMessage = params.existingSha
      ? `chore(docs): update ${params.fileName} via DevFlow [skip ci]`
      : `feat(docs): upload ${params.fileName} via DevFlow [skip ci]`;

    const body: Record<string, any> = {
      message: commitMessage,
      content: base64Content,
      branch: targetBranch,
    };

    if (params.existingSha) {
      body.sha = params.existingSha;
    }

    const { data: result } = await this.request<any>(
      token,
      `/repos/${repoInfo.owner}/${repoInfo.name}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    return {
      sha: result.content?.sha || '',
      commitSha: result.commit?.sha || '',
      path: repoPath,
      size: params.contentBuffer.length,
      branch: targetBranch,
    };
  }

  /**
   * Retrieves raw file content from the private GitHub repository.
   */
  public static async getDocumentContent(params: {
    projectId: number;
    repositoryPath: string;
    branch?: string;
  }): Promise<GitHubFileContentResult> {
    const { token } = await this.resolveGitHubCredentials(params.projectId);
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId: params.projectId },
    });

    if (!storageConn) {
      throw new Error('Project storage connection is not configured.');
    }
    if (storageConn.connectionStatus === 'unlinked') {
      throw new Error('Document storage repository is currently unlinked. Relink it in Project Settings > Storage to view files.');
    }

    const cleanPath = params.repositoryPath.replace(/^\/+/, '');
    const targetBranch = (params.branch || '').trim() || storageConn.defaultBranch || 'main';
    const endpoint = `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(targetBranch)}`;

    // Request raw binary data
    const { data: buffer, headers } = await this.request<Buffer>(token, endpoint, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
      },
    });

    const sha = headers.get('etag')?.replace(/["W/]/g, '') || '';
    const contentType = headers.get('content-type') || 'application/octet-stream';

    return {
      buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
      contentType,
      size: buffer.length,
      sha,
    };
  }

  /**
   * Deletes a document file from the private GitHub repository.
   */
  public static async deleteDocumentFile(params: {
    projectId: number;
    repositoryPath: string;
    fileSha: string;
    fileName: string;
    branch?: string;
  }): Promise<boolean> {
    const { token } = await this.resolveGitHubCredentials(params.projectId);
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId: params.projectId },
    });

    if (!storageConn) {
      throw new Error('Project storage connection not found');
    }
    if (storageConn.connectionStatus === 'unlinked') {
      throw new Error('Cannot remove file from GitHub while the storage repository is unlinked.');
    }

    const cleanPath = params.repositoryPath.replace(/^\/+/, '');
    const targetBranch = (params.branch || '').trim() || storageConn.defaultBranch || 'main';
    const endpoint = `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`;

    await this.request(token, endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore(docs): delete ${params.fileName} via DevFlow [skip ci]`,
        sha: params.fileSha,
        branch: targetBranch,
      }),
    });

    return true;
  }

  /**
   * Healthcheck for storage connection & repository
   */
  public static async checkStorageHealth(projectId: number): Promise<{
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
  }> {
    try {
      const storageConn = await (prisma as any).projectStorageConnection.findUnique({
        where: { projectId },
      });

      if (!storageConn) {
        return { isHealthy: false, connectionStatus: 'disconnected', error: 'No repository connected yet' };
      }

      if (storageConn.connectionStatus === 'unlinked') {
        return {
          isHealthy: false,
          connectionStatus: 'unlinked',
          repositoryUrl: storageConn.repositoryUrl,
          repositoryName: storageConn.repositoryName,
          defaultBranch: storageConn.defaultBranch,
          error: 'Repository is currently unlinked. Relink in Project Settings > Storage.',
        };
      }

      const { token } = await this.resolveGitHubCredentials(projectId);
      const { data: repo, headers } = await this.request<any>(
        token,
        `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}`
      );

      const rateLimitRemaining = parseInt(headers.get('x-ratelimit-remaining') || '5000', 10);
      const rateLimitLimit = parseInt(headers.get('x-ratelimit-limit') || '5000', 10);

      return {
        isHealthy: true,
        connectionStatus: 'connected',
        repositoryUrl: repo.html_url,
        repositoryName: repo.name,
        defaultBranch: repo.default_branch,
        isPrivate: Boolean(repo.private),
        repoSizeKb: typeof repo.size === 'number' ? repo.size : undefined,
        rateLimitRemaining,
        rateLimitLimit,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        connectionStatus: 'error',
        error: err.message || 'Failed to verify repository connectivity',
      };
    }
  }

  /**
   * Fetches all GitHub branches and per-branch git tree sizes for the storage repository.
   */
  public static async getRepositoryBranchesAndStats(projectId: number): Promise<{
    branches: GitHubBranchStat[];
    repoSizeKb: number | null;
    defaultBranch: string;
    isPrivate: boolean;
  }> {
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });

    if (!storageConn || storageConn.connectionStatus === 'unlinked') {
      return {
        branches: [],
        repoSizeKb: null,
        defaultBranch: storageConn?.defaultBranch || 'main',
        isPrivate: true,
      };
    }

    try {
      const { token } = await this.resolveGitHubCredentials(projectId);
      const owner = storageConn.providerOwner;
      const repoName = storageConn.repositoryName;

      const [{ data: repoData }, { data: branchesRaw }] = await Promise.all([
        this.request<any>(token, `/repos/${owner}/${repoName}`),
        this.request<any[]>(token, `/repos/${owner}/${repoName}/branches?per_page=50`),
      ]);

      const defaultBranch = repoData?.default_branch || storageConn.defaultBranch || 'main';
      const branchList = Array.isArray(branchesRaw) ? branchesRaw : [];

      const enriched = await Promise.all(
        branchList.slice(0, 15).map(async (b: any): Promise<GitHubBranchStat> => {
          const sha = b.commit?.sha || b.name;
          let treeBytes: number | null = null;
          let blobCount: number | null = null;
          try {
            const { data: treeData } = await this.request<any>(
              token,
              `/repos/${owner}/${repoName}/git/trees/${encodeURIComponent(sha)}?recursive=1`
            );
            if (Array.isArray(treeData?.tree)) {
              const blobs = treeData.tree.filter((item: any) => item.type === 'blob');
              blobCount = blobs.length;
              treeBytes = blobs.reduce((acc: number, item: any) => acc + (Number(item.size) || 0), 0);
            }
          } catch {
            // Empty or unreachable tree; fall back gracefully to tracked DB totals
          }
          return {
            name: b.name,
            commitSha: sha,
            isDefault: b.name === defaultBranch,
            protected: Boolean(b.protected),
            gitHubTreeBytes: treeBytes,
            gitHubBlobCount: blobCount,
          };
        })
      );

      return {
        branches: enriched,
        repoSizeKb: typeof repoData?.size === 'number' ? repoData.size : null,
        defaultBranch,
        isPrivate: Boolean(repoData?.private ?? true),
      };
    } catch {
      return {
        branches: [],
        repoSizeKb: null,
        defaultBranch: storageConn.defaultBranch || 'main',
        isPrivate: true,
      };
    }
  }

  /**
   * Lists accessible GitHub repositories for relinking/switching storage repos.
   */
  public static async listAccessibleRepositories(projectId: number): Promise<
    Array<{
      id: string;
      name: string;
      fullName: string;
      owner: string;
      isPrivate: boolean;
      defaultBranch: string;
      webUrl: string;
      sizeKb: number;
    }>
  > {
    const { token } = await this.resolveGitHubCredentials(projectId);
    const { data: repos } = await this.request<any[]>(
      token,
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator'
    );
    return (Array.isArray(repos) ? repos : []).map((r: any) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || r.full_name?.split('/')[0] || '',
      isPrivate: Boolean(r.private),
      defaultBranch: r.default_branch || 'main',
      webUrl: r.html_url,
      sizeKb: typeof r.size === 'number' ? r.size : 0,
    }));
  }

  /**
   * Unlinks the project's storage repository while preserving metadata so relinking restores access.
   */
  public static async unlinkRepository(projectId: number) {
    const existingConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });

    if (!existingConn) {
      throw new Error('No document storage repository is currently linked to this project.');
    }

    return await (prisma as any).projectStorageConnection.update({
      where: { projectId },
      data: {
        connectionStatus: 'unlinked',
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Ensures a target branch exists inside the project's connected storage repository.
   */
  public static async ensureBranchForProject(projectId: number, branchName: string): Promise<string | null> {
    const cleanBranch = (branchName || '').trim();
    if (!cleanBranch) return null;
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });
    if (!storageConn || storageConn.connectionStatus === 'unlinked') {
      return null;
    }
    const { token } = await this.resolveGitHubCredentials(projectId);
    const defaultBranch = storageConn.defaultBranch || 'main';
    await this.ensureBranchExists(
      token,
      storageConn.providerOwner,
      storageConn.repositoryName,
      cleanBranch,
      defaultBranch
    );
    return cleanBranch;
  }

  /**
   * Relinks the previous repository (or switches to a selected GitHub repository).
   */
  public static async relinkRepository(
    projectId: number,
    projectTitle: string,
    target?: { owner?: string; repositoryName?: string; branch?: string }
  ) {
    const { token, owner: credOwner, connectionId, accountId } = await this.resolveGitHubCredentials(projectId);
    const existingConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });

    const targetOwner = target?.owner?.trim() || existingConn?.providerOwner || credOwner;
    const targetRepoName = target?.repositoryName?.trim() || existingConn?.repositoryName;

    if (!targetRepoName) {
      // Nothing previously linked — provision default devflow repo
      if (existingConn) {
        await (prisma as any).projectStorageConnection.update({
          where: { projectId },
          data: { connectionStatus: 'connected' },
        });
      }
      return await this.ensureDocumentRepository(projectId, projectTitle);
    }

    const { data: repo } = await this.request<any>(
      token,
      `/repos/${encodeURIComponent(targetOwner)}/${encodeURIComponent(targetRepoName)}`
    );

    const branchToUse = target?.branch?.trim() || repo.default_branch || existingConn?.defaultBranch || 'main';

    await (prisma as any).projectStorageConnection.upsert({
      where: { projectId },
      update: {
        provider: 'github',
        providerAccountId: accountId || credOwner,
        providerOwner: repo.owner?.login || targetOwner,
        providerRepoId: repo.id.toString(),
        repositoryName: repo.name,
        repositoryUrl: repo.html_url,
        defaultBranch: branchToUse,
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
        providerConnectionId: connectionId || existingConn?.providerConnectionId || null,
      },
      create: {
        projectId,
        provider: 'github',
        providerAccountId: accountId || credOwner,
        providerOwner: repo.owner?.login || targetOwner,
        providerRepoId: repo.id.toString(),
        repositoryName: repo.name,
        repositoryUrl: repo.html_url,
        defaultBranch: branchToUse,
        connectionStatus: 'connected',
        lastSyncAt: new Date(),
        providerConnectionId: connectionId || null,
      },
    });

    return {
      repoId: repo.id.toString(),
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || targetOwner,
      webUrl: repo.html_url,
      defaultBranch: branchToUse,
      isPrivate: Boolean(repo.private),
    };
  }
}

