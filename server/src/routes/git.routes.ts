import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { encryptSecret, decryptSecret, maskToken } from '../lib/crypto.js';
import { getGitProviderAdapter } from '../services/git/gitProviderFactory.js';
import type {
  GitOverviewStats,
  GitActivityEvent,
  GitNormalizedIssue,
  GitNormalizedMR,
} from '../services/git/git.types.js';

export const gitRoutes = Router({ mergeParams: true });

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// ─── AUTH & PROJECT PERMISSION HELPER ────────────────────────────────────────

async function checkProjectAccess(projectId: number, userId: number | null) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: true,
      organization: {
        include: { members: true },
      },
    },
  });

  if (!project) {
    return { allowed: false, notFound: true, project: null };
  }

  if (!userId) {
    // In dev / test mode allow access
    return { allowed: true, notFound: false, project };
  }

  const isOwner = project.ownerId === userId;
  const isLead = project.leadId === userId;
  const isProjectMember = project.members.some((m) => m.userId === userId);
  const isOrgMember = project.organization?.members.some((m) => m.userId === userId) ?? false;

  return { allowed: isOwner || isLead || isProjectMember || isOrgMember, notFound: false, project };
}

// ─── GIT MEMBER MAPPING HELPERS ──────────────────────────────────────────────

async function getProjectMemberMappingsAndUsers(projectId: number) {
  const [rawMappings, project] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.project_id AS projectId, m.user_id AS userId, 
              m.git_username AS gitUsername, m.git_email AS gitEmail, 
              m.git_name AS gitName, m.avatar_url AS avatarUrl, 
              m.created_at AS createdAt, m.updated_at AS updatedAt,
              u.name, u.email, u.username, u.avatarUrl AS userAvatarUrl, 
              u.avatarColor AS userAvatarColor, u.role
       FROM git_member_mappings m
       JOIN users u ON m.user_id = u.id
       WHERE m.project_id = ?
       ORDER BY m.created_at DESC`,
      projectId
    ).catch(() => []),
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { select: { id: true, name: true, email: true, username: true, avatarUrl: true, avatarColor: true, role: true } },
        lead: { select: { id: true, name: true, email: true, username: true, avatarUrl: true, avatarColor: true, role: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, username: true, avatarUrl: true, avatarColor: true, role: true } },
          },
        },
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true, username: true, avatarUrl: true, avatarColor: true, role: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const userMap = new Map<number, any>();
  if (project?.owner) userMap.set(project.owner.id, project.owner);
  if (project?.lead) userMap.set(project.lead.id, project.lead);
  project?.members?.forEach((pm) => {
    if (pm.user) userMap.set(pm.user.id, pm.user);
  });
  project?.team?.members?.forEach((tm) => {
    if (tm.user) userMap.set(tm.user.id, tm.user);
  });

  const members = Array.from(userMap.values());

  const formattedMappings = rawMappings.map((m) => ({
    id: m.id,
    projectId: m.projectId,
    userId: m.userId,
    gitUsername: m.gitUsername,
    gitEmail: m.gitEmail,
    gitName: m.gitName,
    avatarUrl: m.avatarUrl,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    user: {
      id: m.userId,
      name: m.name,
      email: m.email,
      username: m.username,
      avatarUrl: m.userAvatarUrl,
      avatarColor: m.userAvatarColor,
      role: m.role,
    },
  }));

  return { mappings: formattedMappings, members };
}

function matchCommitToUser(
  commit: { authorName?: string; name?: string; authorEmail?: string; email?: string; authorUsername?: string; username?: string },
  mappings: any[],
  members: any[]
) {
  const commitEmail = (commit.authorEmail || commit.email)?.trim().toLowerCase();
  const commitUsername = (commit.authorUsername || commit.username)?.trim().toLowerCase();
  const commitName = (commit.authorName || commit.name)?.trim().toLowerCase();

  // 1. Explicit mapping matches
  for (const m of mappings) {
    if (commitEmail && m.gitEmail && m.gitEmail.trim().toLowerCase() === commitEmail) {
      return m.user;
    }
    if (commitUsername && m.gitUsername && m.gitUsername.trim().toLowerCase() === commitUsername) {
      return m.user;
    }
    if (commitName && m.gitName && m.gitName.trim().toLowerCase() === commitName) {
      return m.user;
    }
  }

  // 2. Direct user identity matches (email, username, or display name)
  for (const u of members) {
    if (commitEmail && u.email && u.email.trim().toLowerCase() === commitEmail) {
      return u;
    }
    if (commitUsername && u.username && u.username.trim().toLowerCase() === commitUsername) {
      return u;
    }
    if (commitName && u.name && u.name.trim().toLowerCase() === commitName) {
      return u;
    }
  }

  return null;
}

// ─── ENVIRONMENT CONFIG & OAUTH HELPERS ──────────────────────────────────────

// GET /api/projects/:projectId/git/env-config
gitRoutes.get('/env-config', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const envToken = process.env.GITHUB_TOKEN?.trim() || '';
    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    const callbackUrl = process.env.GITHUB_CALLBACK_URL?.trim() || 'http://localhost:5173/git/callback';

    res.json({
      success: true,
      data: {
        hasEnvToken: Boolean(envToken && envToken.length > 5),
        envTokenMasked: envToken ? maskToken(envToken) : null,
        hasOAuth: Boolean(clientId && clientSecret),
        clientId: clientId || null,
        callbackUrl,
      },
    });
  } catch (error: any) {
    console.error('Error fetching git env config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/auth/github/connect-env-token
gitRoutes.post('/auth/github/connect-env-token', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req) || 1;
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const envToken = process.env.GITHUB_TOKEN?.trim();
    if (!envToken || envToken.length < 5) {
      return res.status(400).json({ success: false, error: 'GITHUB_TOKEN is not configured in server/.env' });
    }

    const adapter = getGitProviderAdapter('github');
    const account = await adapter.verifyToken(envToken);
    const { encrypted, iv, tag } = encryptSecret(envToken);

    // Check if an existing connection for this account and project exists, or create new
    const existing = await (prisma as any).gitProviderConnection.findFirst({
      where: {
        projectId,
        provider: 'github',
        accountName: account.accountName,
      },
    });

    let connection;
    if (existing) {
      connection = await (prisma as any).gitProviderConnection.update({
        where: { id: existing.id },
        data: {
          tokenEncrypted: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          accountEmail: account.accountEmail || null,
          avatarUrl: account.avatarUrl || null,
          status: 'active',
          scopes: account.scopes?.join(',') || null,
        },
      });
    } else {
      connection = await (prisma as any).gitProviderConnection.create({
        data: {
          projectId,
          organizationId: project?.organizationId || null,
          userId,
          provider: 'github',
          authType: 'pat',
          tokenEncrypted: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          accountName: account.accountName,
          accountEmail: account.accountEmail || null,
          avatarUrl: account.avatarUrl || null,
          status: 'active',
          scopes: account.scopes?.join(',') || null,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: connection.id,
        provider: connection.provider,
        accountName: connection.accountName,
        accountEmail: connection.accountEmail,
        avatarUrl: connection.avatarUrl,
        status: connection.status,
        maskedToken: maskToken(envToken),
      },
    });
  } catch (error: any) {
    console.error('Error connecting env token:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to authenticate with GitHub using GITHUB_TOKEN' });
  }
});

// POST /api/projects/:projectId/git/auth/github/oauth-exchange
gitRoutes.post('/auth/github/oauth-exchange', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req) || 1;
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        error: 'GitHub OAuth is not configured in server/.env (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required)',
      });
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;
    if (!tokenData.access_token) {
      return res.status(400).json({
        success: false,
        error: tokenData.error_description || tokenData.error || 'Failed to exchange authorization code for GitHub token',
      });
    }

    const token = tokenData.access_token;
    const adapter = getGitProviderAdapter('github');
    const account = await adapter.verifyToken(token);
    const { encrypted, iv, tag } = encryptSecret(token);

    const existing = await (prisma as any).gitProviderConnection.findFirst({
      where: {
        projectId,
        provider: 'github',
        accountName: account.accountName,
      },
    });

    let connection;
    if (existing) {
      connection = await (prisma as any).gitProviderConnection.update({
        where: { id: existing.id },
        data: {
          tokenEncrypted: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          accountEmail: account.accountEmail || null,
          avatarUrl: account.avatarUrl || null,
          status: 'active',
          scopes: tokenData.scope || account.scopes?.join(',') || null,
        },
      });
    } else {
      connection = await (prisma as any).gitProviderConnection.create({
        data: {
          projectId,
          organizationId: project?.organizationId || null,
          userId,
          provider: 'github',
          authType: 'oauth',
          tokenEncrypted: encrypted,
          tokenIv: iv,
          tokenTag: tag,
          accountName: account.accountName,
          accountEmail: account.accountEmail || null,
          avatarUrl: account.avatarUrl || null,
          status: 'active',
          scopes: tokenData.scope || account.scopes?.join(',') || null,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: connection.id,
        provider: connection.provider,
        accountName: connection.accountName,
        accountEmail: connection.accountEmail,
        avatarUrl: connection.avatarUrl,
        status: connection.status,
        maskedToken: maskToken(token),
      },
    });
  } catch (error: any) {
    console.error('Error in GitHub oauth exchange:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/connections
gitRoutes.get('/connections', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const connections = await (prisma as any).gitProviderConnection.findMany({
      where: {
        OR: [
          { projectId },
          ...(project?.organizationId ? [{ organizationId: project.organizationId }] : []),
          ...(userId ? [{ userId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = connections.map((c: any) => ({
      id: c.id,
      projectId: c.projectId,
      organizationId: c.organizationId,
      userId: c.userId,
      provider: c.provider,
      authType: c.authType,
      accountName: c.accountName,
      accountEmail: c.accountEmail,
      avatarUrl: c.avatarUrl,
      status: c.status,
      scopes: c.scopes,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json({ success: true, data: sanitized });
  } catch (error: any) {
    console.error('Error fetching git connections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/connections
gitRoutes.post('/connections', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req) || 1;
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const schema = z.object({
      provider: z.enum(['github', 'gitlab']),
      token: z.string().trim().min(5, 'Token is required'),
      authType: z.enum(['pat', 'oauth']).optional().default('pat'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid connection parameters' });
    }

    const { provider, token, authType } = parsed.data;
    const adapter = getGitProviderAdapter(provider);

    // Verify token with provider
    const account = await adapter.verifyToken(token);

    // Encrypt token
    const { encrypted, iv, tag } = encryptSecret(token);

    const connection = await (prisma as any).gitProviderConnection.create({
      data: {
        projectId,
        organizationId: project?.organizationId || null,
        userId,
        provider,
        authType,
        tokenEncrypted: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        accountName: account.accountName,
        accountEmail: account.accountEmail || null,
        avatarUrl: account.avatarUrl || null,
        status: 'active',
        scopes: account.scopes?.join(',') || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: connection.id,
        provider: connection.provider,
        accountName: connection.accountName,
        accountEmail: connection.accountEmail,
        avatarUrl: connection.avatarUrl,
        status: connection.status,
        maskedToken: maskToken(token),
      },
    });
  } catch (error: any) {
    console.error('Error adding git connection:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to authenticate with provider' });
  }
});

// DELETE /api/projects/:projectId/git/connections/:connectionId
gitRoutes.delete('/connections/:connectionId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const connectionId = parseId(req.params.connectionId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    await (prisma as any).gitProviderConnection.delete({
      where: { id: connectionId },
    });

    res.json({ success: true, message: 'Provider connection removed' });
  } catch (error: any) {
    console.error('Error deleting git connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/provider-repos/:connectionId
gitRoutes.get('/provider-repos/:connectionId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const connectionId = parseId(req.params.connectionId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const connection = await (prisma as any).gitProviderConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const decryptedToken = decryptSecret(
      connection.tokenEncrypted,
      connection.tokenIv,
      connection.tokenTag
    );

    const adapter = getGitProviderAdapter(connection.provider);
    const repos = await adapter.listRepositories(decryptedToken);

    res.json({ success: true, data: repos });
  } catch (error: any) {
    console.error('Error fetching provider repositories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── REPOSITORIES ───────────────────────────────────────────────────────────

// GET /api/projects/:projectId/git/repositories
gitRoutes.get('/repositories', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const repos = await (prisma as any).gitRepositoryConnection.findMany({
      where: { projectId },
      include: {
        providerConnection: {
          select: { provider: true, accountName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: repos });
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/repositories
gitRoutes.post('/repositories', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const schema = z.object({
      connectionId: z.number().int(),
      providerRepoId: z.union([z.string(), z.number()]).optional().transform((v) => String(v ?? '')),
      name: z.string().trim().min(1, 'Repository name is required'),
      fullName: z.string().trim().min(1, 'Repository full name is required'),
      owner: z.string().trim().optional(),
      defaultBranch: z.string().trim().default('main'),
      isPrivate: z.boolean().default(false),
      webUrl: z.string().trim().optional(),
      cloneUrl: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return res.status(400).json({ success: false, error: errorMsg });
    }

    const fullName = parsed.data.fullName;
    const owner = parsed.data.owner || fullName.split('/')[0] || '';
    const name = parsed.data.name || fullName.split('/')[1] || fullName;
    const providerRepoId = parsed.data.providerRepoId && parsed.data.providerRepoId.length > 0 ? parsed.data.providerRepoId : fullName;
    const webUrl = parsed.data.webUrl && parsed.data.webUrl.length > 0 ? parsed.data.webUrl : `https://github.com/${fullName}`;

    const repo = await (prisma as any).gitRepositoryConnection.upsert({
      where: {
        projectId_fullName: {
          projectId,
          fullName,
        },
      },
      update: {
        syncStatus: 'healthy',
        lastSyncAt: new Date(),
        webUrl,
        cloneUrl: parsed.data.cloneUrl || null,
        defaultBranch: parsed.data.defaultBranch,
        isPrivate: parsed.data.isPrivate,
      },
      create: {
        projectId,
        connectionId: parsed.data.connectionId,
        providerRepoId,
        name,
        fullName,
        owner,
        defaultBranch: parsed.data.defaultBranch,
        isPrivate: parsed.data.isPrivate,
        webUrl,
        cloneUrl: parsed.data.cloneUrl || null,
        syncStatus: 'healthy',
        lastSyncAt: new Date(),
      },
    });

    res.status(201).json({ success: true, data: repo });
  } catch (error: any) {
    console.error('Error connecting repository:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:projectId/git/repositories/:repoId
gitRoutes.delete('/repositories/:repoId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    await (prisma as any).gitRepositoryConnection.delete({
      where: { id: repoId },
    });

    res.json({ success: true, message: 'Repository disconnected' });
  } catch (error: any) {
    console.error('Error disconnecting repository:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/repositories/:repoId/sync
gitRoutes.post('/repositories/:repoId/sync', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });

    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );

    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const latestSummary = await adapter.getRepository(decryptedToken, repo.owner, repo.name);

    // Deep sync: fetch branches, commits, issues and pull requests
    const [branchesRes, commitsRes, issuesRes, mrsRes] = await Promise.allSettled([
      adapter.listBranches(decryptedToken, repo.owner, repo.name),
      adapter.listCommits(decryptedToken, repo.owner, repo.name, undefined, 15),
      adapter.listIssues(decryptedToken, repo.owner, repo.name, { state: 'all', perPage: 20 }),
      adapter.listMergeRequests(decryptedToken, repo.owner, repo.name, { state: 'all', perPage: 20 }),
    ]);

    const branches = branchesRes.status === 'fulfilled' ? branchesRes.value : [];
    const commits = commitsRes.status === 'fulfilled' ? commitsRes.value : [];
    const issues = issuesRes.status === 'fulfilled' ? issuesRes.value : [];
    const mrs = mrsRes.status === 'fulfilled' ? mrsRes.value : [];

    const updated = await (prisma as any).gitRepositoryConnection.update({
      where: { id: repoId },
      data: {
        syncStatus: 'healthy',
        lastSyncAt: new Date(),
        defaultBranch: latestSummary.defaultBranch,
        isPrivate: latestSummary.isPrivate,
      },
    });

    // Sync project metadata description tag [git:owner/repo]
    const proj = await prisma.project.findUnique({ where: { id: projectId }, select: { description: true } });
    if (proj) {
      const currentDesc = proj.description || '';
      let newDesc = currentDesc;
      if (newDesc.includes('[git:')) {
        newDesc = newDesc.replace(/\[git:[^\]]+\]/, `[git:${repo.fullName}]`);
      } else {
        newDesc = `[git:${repo.fullName}] ${newDesc}`.trim();
      }
      if (newDesc !== currentDesc) {
        await prisma.project.update({
          where: { id: projectId },
          data: { description: newDesc },
        });
      }
    }

    res.json({
      success: true,
      data: {
        ...updated,
        syncStats: {
          branchesCount: branches.length,
          commitsCount: commits.length,
          issuesCount: issues.length,
          mrsCount: mrs.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error syncing repository:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/repositories/:repoId/branches
gitRoutes.get('/repositories/:repoId/branches', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const branches = await adapter.listBranches(decryptedToken, repo.owner, repo.name);

    res.json({ success: true, data: branches });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/repositories/:repoId/commits
gitRoutes.get('/repositories/:repoId/commits', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const [commits, { mappings, members }] = await Promise.all([
      adapter.listCommits(decryptedToken, repo.owner, repo.name, branch, 30),
      getProjectMemberMappingsAndUsers(projectId),
    ]);

    const enrichedCommits = commits.map((c) => ({
      ...c,
      mappedUser: matchCommitToUser(c, mappings, members),
    }));

    res.json({ success: true, data: enrichedCommits });
  } catch (error: any) {
    console.error('Error fetching commits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/repositories/:repoId/commits/:sha
gitRoutes.get('/repositories/:repoId/commits/:sha', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const sha = (Array.isArray(req.params.sha) ? req.params.sha[0] : req.params.sha) || '';

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const [commit, { mappings, members }] = await Promise.all([
      adapter.getCommit(decryptedToken, repo.owner, repo.name, sha),
      getProjectMemberMappingsAndUsers(projectId),
    ]);

    const enrichedCommit = {
      ...commit,
      mappedUser: matchCommitToUser(commit, mappings, members),
    };

    res.json({ success: true, data: enrichedCommit });
  } catch (error: any) {
    console.error('Error fetching commit detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/repositories/:repoId/tree
gitRoutes.get('/repositories/:repoId/tree', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    const ref = typeof req.query.ref === 'string' ? req.query.ref : undefined;

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const tree = await adapter.getTree(decryptedToken, repo.owner, repo.name, path, ref);

    res.json({ success: true, data: tree });
  } catch (error: any) {
    console.error('Error fetching repository tree:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/repositories/:repoId/blob
gitRoutes.get('/repositories/:repoId/blob', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    const ref = typeof req.query.ref === 'string' ? req.query.ref : undefined;

    if (!path) {
      return res.status(400).json({ success: false, error: 'Path query parameter is required' });
    }

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const blob = await adapter.getFileContent(decryptedToken, repo.owner, repo.name, path, ref);

    res.json({ success: true, data: blob });
  } catch (error: any) {
    console.error('Error fetching blob file content:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── OVERVIEW METRICS & ACTIVITY ────────────────────────────────────────────

// GET /api/projects/:projectId/git/overview
gitRoutes.get('/overview', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const repos = await (prisma as any).gitRepositoryConnection.findMany({
      where: { projectId },
      include: { providerConnection: true },
    });

    const stats: GitOverviewStats = {
      totalRepositories: repos.length,
      openIssues: 0,
      closedIssues: 0,
      openMergeRequests: 0,
      mrsAwaitingReview: 0,
      approvedMrs: 0,
      mergedMrs: 0,
      mrsWithConflicts: 0,
      recentCommitsCount: 0,
    };

    const activity: GitActivityEvent[] = [];
    const allRecentIssues: GitNormalizedIssue[] = [];
    const allRecentMRs: GitNormalizedMR[] = [];

    // Aggregate data across all connected repos
    await Promise.all(
      repos.map(async (repo: any) => {
        try {
          const decryptedToken = decryptSecret(
            repo.providerConnection.tokenEncrypted,
            repo.providerConnection.tokenIv,
            repo.providerConnection.tokenTag
          );
          const adapter = getGitProviderAdapter(repo.providerConnection.provider);

          const [openIssues, openMRs, recentCommits] = await Promise.all([
            adapter.listIssues(decryptedToken, repo.owner, repo.name, { state: 'open', perPage: 20 }).catch(() => []),
            adapter.listMergeRequests(decryptedToken, repo.owner, repo.name, { state: 'open', perPage: 20 }).catch(() => []),
            adapter.listCommits(decryptedToken, repo.owner, repo.name, undefined, 10).catch(() => []),
          ]);

          stats.openIssues += openIssues.length;
          stats.openMergeRequests += openMRs.length;
          stats.recentCommitsCount += recentCommits.length;

          // Check reviews and conflicts on open MRs
          openMRs.forEach((mr) => {
            if (mr.hasConflicts) stats.mrsWithConflicts++;
            if (mr.reviewers.some((r) => r.status === 'approved')) stats.approvedMrs++;
            else stats.mrsAwaitingReview++;
          });

          // Tag with repo ID
          openIssues.forEach((i) => {
            i.repositoryId = repo.id;
            allRecentIssues.push(i);
          });
          openMRs.forEach((m) => {
            m.repositoryId = repo.id;
            allRecentMRs.push(m);
          });

          // Commits into activity stream
          recentCommits.forEach((c) => {
            activity.push({
              id: `commit:${repo.fullName}:${c.sha}`,
              type: 'commit',
              title: c.message,
              actor: {
                name: c.authorName,
                username: c.authorName,
                avatarUrl: c.authorAvatarUrl,
              },
              repoFullName: repo.fullName,
              timestamp: c.committedDate,
              webUrl: c.webUrl,
              sha: c.sha,
            });
          });

          // MRs into activity stream
          openMRs.slice(0, 3).forEach((m) => {
            activity.push({
              id: `mr:${repo.fullName}:${m.number}`,
              type: 'mr_opened',
              title: m.title,
              actor: m.author,
              repoFullName: repo.fullName,
              timestamp: m.createdAt,
              webUrl: m.webUrl,
              referenceNumber: m.number,
            });
          });
        } catch (err) {
          console.error(`Error loading metrics for ${repo.fullName}:`, err);
        }
      })
    );

    // Sort activity by timestamp desc
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: {
        stats,
        activity: activity.slice(0, 30),
        recentIssues: allRecentIssues.slice(0, 10),
        recentMergeRequests: allRecentMRs.slice(0, 10),
      },
    });
  } catch (error: any) {
    console.error('Error generating git overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ISSUES ─────────────────────────────────────────────────────────────────

// GET /api/projects/:projectId/git/issues
gitRoutes.get('/issues', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const state = typeof req.query.state === 'string' ? (req.query.state as any) : 'open';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : undefined;
    const repoIdParam = req.query.repoId ? parseId(req.query.repoId as string) : NaN;

    const whereClause: any = { projectId };
    if (!isNaN(repoIdParam)) {
      whereClause.id = repoIdParam;
    }

    const repos = await (prisma as any).gitRepositoryConnection.findMany({
      where: whereClause,
      include: { providerConnection: true },
    });

    const issues: GitNormalizedIssue[] = [];

    await Promise.all(
      repos.map(async (repo: any) => {
        try {
          const decryptedToken = decryptSecret(
            repo.providerConnection.tokenEncrypted,
            repo.providerConnection.tokenIv,
            repo.providerConnection.tokenTag
          );
          const adapter = getGitProviderAdapter(repo.providerConnection.provider);
          const repoIssues = await adapter.listIssues(decryptedToken, repo.owner, repo.name, {
            state,
            search,
          });

          repoIssues.forEach((i) => {
            i.repositoryId = repo.id;
            issues.push(i);
          });
        } catch (err) {
          console.error(`Error listing issues for ${repo.fullName}:`, err);
        }
      })
    );

    let filtered = issues;
    if (search) {
      filtered = issues.filter(
        (i) =>
          i.title.toLowerCase().includes(search) ||
          i.number.toString().includes(search) ||
          i.repoFullName.toLowerCase().includes(search)
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('Error fetching git issues:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/issues/:repoId/:issueNumber
gitRoutes.get('/issues/:repoId/:issueNumber', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const issueNumber = parseId(req.params.issueNumber);

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const issue = await adapter.getIssue(decryptedToken, repo.owner, repo.name, issueNumber);
    issue.repositoryId = repo.id;

    res.json({ success: true, data: issue });
  } catch (error: any) {
    console.error('Error fetching issue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/issues/:repoId
gitRoutes.post('/issues/:repoId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);

    const schema = z.object({
      title: z.string().trim().min(1, 'Title is required'),
      body: z.string().default(''),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed' });

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const issue = await adapter.createIssue(decryptedToken, repo.owner, repo.name, parsed.data);
    issue.repositoryId = repo.id;

    res.status(201).json({ success: true, data: issue });
  } catch (error: any) {
    console.error('Error creating issue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/projects/:projectId/git/issues/:repoId/:issueNumber
gitRoutes.patch('/issues/:repoId/:issueNumber', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const issueNumber = parseId(req.params.issueNumber);

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const updated = await adapter.updateIssue(decryptedToken, repo.owner, repo.name, issueNumber, req.body);
    updated.repositoryId = repo.id;

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating issue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── MERGE REQUESTS ─────────────────────────────────────────────────────────

// GET /api/projects/:projectId/git/merge-requests
gitRoutes.get('/merge-requests', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const state = typeof req.query.state === 'string' ? (req.query.state as any) : 'open';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : undefined;
    const repoIdParam = req.query.repoId ? parseId(req.query.repoId as string) : NaN;
    const hasConflictsParam = req.query.hasConflicts === 'true';

    const whereClause: any = { projectId };
    if (!isNaN(repoIdParam)) {
      whereClause.id = repoIdParam;
    }

    const repos = await (prisma as any).gitRepositoryConnection.findMany({
      where: whereClause,
      include: { providerConnection: true },
    });

    const mergeRequests: GitNormalizedMR[] = [];

    await Promise.all(
      repos.map(async (repo: any) => {
        try {
          const decryptedToken = decryptSecret(
            repo.providerConnection.tokenEncrypted,
            repo.providerConnection.tokenIv,
            repo.providerConnection.tokenTag
          );
          const adapter = getGitProviderAdapter(repo.providerConnection.provider);
          const repoMRs = await adapter.listMergeRequests(decryptedToken, repo.owner, repo.name, {
            state,
            search,
          });

          repoMRs.forEach((m) => {
            m.repositoryId = repo.id;
            mergeRequests.push(m);
          });
        } catch (err) {
          console.error(`Error listing MRs for ${repo.fullName}:`, err);
        }
      })
    );

    let filtered = mergeRequests;
    if (search) {
      filtered = mergeRequests.filter(
        (m) =>
          m.title.toLowerCase().includes(search) ||
          m.number.toString().includes(search) ||
          m.sourceBranch.toLowerCase().includes(search) ||
          m.targetBranch.toLowerCase().includes(search)
      );
    }

    if (hasConflictsParam) {
      filtered = filtered.filter((m) => m.hasConflicts);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('Error fetching merge requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/merge-requests/:repoId/:mrNumber
gitRoutes.get('/merge-requests/:repoId/:mrNumber', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const mrNumber = parseId(req.params.mrNumber);

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const mr = await adapter.getMergeRequest(decryptedToken, repo.owner, repo.name, mrNumber);
    mr.repositoryId = repo.id;

    res.json({ success: true, data: mr });
  } catch (error: any) {
    console.error('Error fetching MR details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/git/merge-requests/:repoId/:mrNumber/diff
gitRoutes.get('/merge-requests/:repoId/:mrNumber/diff', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const mrNumber = parseId(req.params.mrNumber);

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const diff = await adapter.getMergeRequestDiff(decryptedToken, repo.owner, repo.name, mrNumber);

    res.json({ success: true, data: diff });
  } catch (error: any) {
    console.error('Error fetching MR diff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/merge-requests/:repoId
gitRoutes.post('/merge-requests/:repoId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);

    const schema = z.object({
      title: z.string().trim().min(1, 'Title is required'),
      body: z.string().default(''),
      sourceBranch: z.string().trim().min(1),
      targetBranch: z.string().trim().min(1),
      draft: z.boolean().default(false),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed' });

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);
    const mr = await adapter.createMergeRequest(decryptedToken, repo.owner, repo.name, parsed.data);
    mr.repositoryId = repo.id;

    res.status(201).json({ success: true, data: mr });
  } catch (error: any) {
    console.error('Error creating MR:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/merge-requests/:repoId/:mrNumber/merge
gitRoutes.post('/merge-requests/:repoId/:mrNumber/merge', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const repoId = parseId(req.params.repoId);
    const mrNumber = parseId(req.params.mrNumber);

    const schema = z.object({
      commitTitle: z.string().optional(),
      commitMessage: z.string().optional(),
      mergeMethod: z.enum(['merge', 'squash', 'rebase']).default('merge'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed' });

    const repo = await (prisma as any).gitRepositoryConnection.findUnique({
      where: { id: repoId },
      include: { providerConnection: true },
    });
    if (!repo) return res.status(404).json({ success: false, error: 'Repository not found' });

    const decryptedToken = decryptSecret(
      repo.providerConnection.tokenEncrypted,
      repo.providerConnection.tokenIv,
      repo.providerConnection.tokenTag
    );
    const adapter = getGitProviderAdapter(repo.providerConnection.provider);

    // Call real provider API to execute the merge (never simulate)
    const result = await adapter.mergeMergeRequest(
      decryptedToken,
      repo.owner,
      repo.name,
      mrNumber,
      parsed.data
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error executing merge request:', error);
    res.status(400).json({ success: false, error: error.message || 'Merge rejected by provider' });
  }
});

// ─── RECORD LINKS ───────────────────────────────────────────────────────────

// GET /api/projects/:projectId/git/links
gitRoutes.get('/links', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const recordId = typeof req.query.recordId === 'string' ? req.query.recordId : undefined;

    const whereClause: any = { projectId };
    if (recordId) whereClause.recordId = recordId;

    const links = await (prisma as any).gitRecordLink.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    // Populate target entity details (Task or Requirement)
    const enriched = await Promise.all(
      links.map(async (l: any) => {
        let targetDetails = null;
        if (l.targetType === 'task' || l.targetType === 'defect') {
          const task = await prisma.task.findUnique({
            where: { id: l.targetId },
            select: { id: true, title: true, status: true, priority: true },
          });
          if (task) targetDetails = task;
        } else if (l.targetType === 'requirement') {
          const req = await prisma.requirement.findUnique({
            where: { id: l.targetId },
            select: { id: true, title: true, workflowStatus: true, priority: true },
          });
          if (req) targetDetails = { id: req.id, title: req.title, status: req.workflowStatus, priority: req.priority };
        }
        return { ...l, targetDetails };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Error fetching git record links:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/links
gitRoutes.post('/links', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);

    const schema = z.object({
      repositoryId: z.number().int().optional(),
      provider: z.string().trim(),
      recordType: z.enum(['issue', 'merge_request', 'commit', 'branch']),
      recordNumber: z.number().int().optional(),
      recordId: z.string().trim().min(1),
      recordTitle: z.string().optional(),
      recordUrl: z.string().optional(),
      targetType: z.enum(['task', 'requirement', 'defect']),
      targetId: z.number().int(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed' });

    const link = await (prisma as any).gitRecordLink.upsert({
      where: {
        projectId_recordId_targetType_targetId: {
          projectId,
          recordId: parsed.data.recordId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
      },
      update: {
        recordTitle: parsed.data.recordTitle,
        recordUrl: parsed.data.recordUrl,
      },
      create: {
        projectId,
        repositoryId: parsed.data.repositoryId,
        provider: parsed.data.provider,
        recordType: parsed.data.recordType,
        recordNumber: parsed.data.recordNumber,
        recordId: parsed.data.recordId,
        recordTitle: parsed.data.recordTitle,
        recordUrl: parsed.data.recordUrl,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        createdById: userId || null,
      },
    });

    res.status(201).json({ success: true, data: link });
  } catch (error: any) {
    console.error('Error creating git record link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:projectId/git/links/:linkId
gitRoutes.delete('/links/:linkId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const linkId = parseId(req.params.linkId);

    await (prisma as any).gitRecordLink.delete({
      where: { id: linkId },
    });

    res.json({ success: true, message: 'Record link deleted' });
  } catch (error: any) {
    console.error('Error deleting record link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GIT MEMBER MAPPING ENDPOINTS ──────────────────────────────────────────

const createMemberMappingSchema = z.object({
  userId: z.number().int().positive('Valid userId is required'),
  gitUsername: z.string().optional().nullable(),
  gitEmail: z.string().optional().nullable(),
  gitName: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
}).refine(
  (data) => Boolean((data.gitUsername && data.gitUsername.trim()) || (data.gitEmail && data.gitEmail.trim()) || (data.gitName && data.gitName.trim())),
  { message: 'At least one Git identity (username, author name, or email) must be specified' }
);

// GET /api/projects/:projectId/git/member-mappings
gitRoutes.get('/member-mappings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const { mappings, members } = await getProjectMemberMappingsAndUsers(projectId);

    // Fetch repositories to detect commit authors from recent repository activity
    const repos = await (prisma as any).gitRepositoryConnection.findMany({
      where: { projectId },
      include: { providerConnection: true },
    });

    const authorMap = new Map<string, any>();
    const memberStats: Record<number, { commitCount: number; latestCommitDate: string | null }> = {};

    for (const m of members) {
      memberStats[m.id] = { commitCount: 0, latestCommitDate: null };
    }

    for (const repo of repos) {
      try {
        const decryptedToken = decryptSecret(
          repo.providerConnection.tokenEncrypted,
          repo.providerConnection.tokenIv,
          repo.providerConnection.tokenTag
        );
        const adapter = getGitProviderAdapter(repo.providerConnection.provider);
        const commits = await adapter.listCommits(decryptedToken, repo.owner, repo.name, undefined, 50);

        for (const c of commits) {
          const authorKey = (c.authorEmail || c.authorUsername || c.authorName || 'unknown').toLowerCase().trim();
          const existing = authorMap.get(authorKey);
          if (!existing) {
            authorMap.set(authorKey, {
              name: c.authorName,
              email: c.authorEmail,
              username: c.authorUsername,
              avatarUrl: c.authorAvatarUrl,
              commitCount: 1,
              latestCommitDate: c.committedDate,
            });
          } else {
            existing.commitCount += 1;
            if (new Date(c.committedDate) > new Date(existing.latestCommitDate)) {
              existing.latestCommitDate = c.committedDate;
            }
          }

          // Track member stats
          const matchedUser = matchCommitToUser(c, mappings, members);
          if (matchedUser) {
            const stats = memberStats[matchedUser.id] || { commitCount: 0, latestCommitDate: null };
            stats.commitCount += 1;
            if (!stats.latestCommitDate || new Date(c.committedDate) > new Date(stats.latestCommitDate)) {
              stats.latestCommitDate = c.committedDate;
            }
            memberStats[matchedUser.id] = stats;
          }
        }
      } catch (err: any) {
        console.warn(`Could not inspect commits for repo ${repo.fullName}:`, err.message);
      }
    }

    // Enrich detected authors with mapping status
    const detectedAuthors = Array.from(authorMap.values()).map((author) => {
      const matchedUser = matchCommitToUser(author, mappings, members);
      return {
        ...author,
        mappedUserId: matchedUser ? matchedUser.id : null,
        mappedUser: matchedUser || null,
      };
    });

    res.json({
      success: true,
      data: {
        mappings,
        members,
        detectedAuthors,
        memberStats,
      },
    });
  } catch (error: any) {
    console.error('Error fetching git member mappings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/git/member-mappings
gitRoutes.post('/member-mappings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const authUserId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, authUserId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const parsed = createMemberMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation failed' });
    }

    const { userId, gitUsername, gitEmail, gitName, avatarUrl } = parsed.data;

    await prisma.$executeRawUnsafe(
      `INSERT INTO git_member_mappings (project_id, user_id, git_username, git_email, git_name, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      projectId,
      userId,
      gitUsername?.trim() || null,
      gitEmail?.trim() || null,
      gitName?.trim() || null,
      avatarUrl || null
    );

    // Fetch newly created mapping with user details
    const createdMappings = await prisma.$queryRawUnsafe<any[]>(
      `SELECT m.id, m.project_id AS projectId, m.user_id AS userId,
              m.git_username AS gitUsername, m.git_email AS gitEmail,
              m.git_name AS gitName, m.avatar_url AS avatarUrl,
              m.created_at AS createdAt, m.updated_at AS updatedAt,
              u.name, u.email, u.username, u.avatarUrl AS userAvatarUrl,
              u.avatarColor AS userAvatarColor, u.role
       FROM git_member_mappings m
       JOIN users u ON m.user_id = u.id
       WHERE m.project_id = ? AND m.user_id = ?
       ORDER BY m.id DESC LIMIT 1`,
      projectId,
      userId
    );

    const record = createdMappings[0];

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        projectId: record.projectId,
        userId: record.userId,
        gitUsername: record.gitUsername,
        gitEmail: record.gitEmail,
        gitName: record.gitName,
        avatarUrl: record.avatarUrl,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        user: {
          id: record.userId,
          name: record.name,
          email: record.email,
          username: record.username,
          avatarUrl: record.userAvatarUrl,
          avatarColor: record.userAvatarColor,
          role: record.role,
        },
      },
    });
  } catch (error: any) {
    console.error('Error creating git member mapping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:projectId/git/member-mappings/:mappingId
gitRoutes.delete('/member-mappings/:mappingId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const mappingId = parseId(req.params.mappingId);
    const authUserId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, authUserId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    await prisma.$executeRawUnsafe(
      `DELETE FROM git_member_mappings WHERE id = ? AND project_id = ?`,
      mappingId,
      projectId
    );

    res.json({ success: true, message: 'Member mapping deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting git member mapping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
