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
   * Uploads or updates a file in the project's private GitHub document repository.
   */
  public static async uploadDocumentFile(params: {
    projectId: number;
    projectTitle: string;
    fileName: string;
    storageKey: string;
    categorySlug?: string;
    contentBuffer: Buffer;
    existingSha?: string;
    uploaderName?: string;
  }): Promise<GitHubFileUploadResult> {
    const { token, owner } = await this.resolveGitHubCredentials(params.projectId);
    const repoInfo = await this.ensureDocumentRepository(params.projectId, params.projectTitle);

    // Build deterministic safe path
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = params.categorySlug
      ? `projects/${params.projectId}/${params.categorySlug}`
      : `projects/${params.projectId}/documents`;
    const repoPath = `${folder}/${params.storageKey}/${safeName}`;

    const base64Content = params.contentBuffer.toString('base64');
    const commitMessage = params.existingSha
      ? `chore(docs): update ${params.fileName} via DevFlow [skip ci]`
      : `feat(docs): upload ${params.fileName} via DevFlow [skip ci]`;

    const body: Record<string, any> = {
      message: commitMessage,
      content: base64Content,
      branch: repoInfo.defaultBranch,
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
    };
  }

  /**
   * Retrieves raw file content from the private GitHub repository.
   */
  public static async getDocumentContent(params: {
    projectId: number;
    repositoryPath: string;
  }): Promise<GitHubFileContentResult> {
    const { token } = await this.resolveGitHubCredentials(params.projectId);
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId: params.projectId },
    });

    if (!storageConn) {
      throw new Error('Project storage connection is not configured.');
    }

    const cleanPath = params.repositoryPath.replace(/^\/+/, '');
    const endpoint = `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`;

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
  }): Promise<boolean> {
    const { token } = await this.resolveGitHubCredentials(params.projectId);
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId: params.projectId },
    });

    if (!storageConn) {
      throw new Error('Project storage connection not found');
    }

    const cleanPath = params.repositoryPath.replace(/^\/+/, '');
    const endpoint = `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}/contents/${encodeURIComponent(cleanPath).replace(/%2F/g, '/')}`;

    await this.request(token, endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore(docs): delete ${params.fileName} via DevFlow [skip ci]`,
        sha: params.fileSha,
        branch: storageConn.defaultBranch || 'main',
      }),
    });

    return true;
  }

  /**
   * Healthcheck for storage connection & repository
   */
  public static async checkStorageHealth(projectId: number): Promise<{
    isHealthy: boolean;
    repositoryUrl?: string;
    repositoryName?: string;
    defaultBranch?: string;
    isPrivate?: boolean;
    rateLimitRemaining?: number;
    rateLimitLimit?: number;
    error?: string;
  }> {
    try {
      const { token } = await this.resolveGitHubCredentials(projectId);
      const storageConn = await (prisma as any).projectStorageConnection.findUnique({
        where: { projectId },
      });

      if (!storageConn) {
        return { isHealthy: false, error: 'No repository connected yet' };
      }

      const { data: repo, headers } = await this.request<any>(
        token,
        `/repos/${storageConn.providerOwner}/${storageConn.repositoryName}`
      );

      const rateLimitRemaining = parseInt(headers.get('x-ratelimit-remaining') || '5000', 10);
      const rateLimitLimit = parseInt(headers.get('x-ratelimit-limit') || '5000', 10);

      return {
        isHealthy: true,
        repositoryUrl: repo.html_url,
        repositoryName: repo.name,
        defaultBranch: repo.default_branch,
        isPrivate: Boolean(repo.private),
        rateLimitRemaining,
        rateLimitLimit,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        error: err.message || 'Failed to verify repository connectivity',
      };
    }
  }
}

