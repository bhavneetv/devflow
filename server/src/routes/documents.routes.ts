import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { GitHubDocumentStorageService } from '../services/documents/gitHubDocumentStorage.service.js';

export const documentsRouter = Router({ mergeParams: true });
export const publicShareRouter = Router();

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// ─── AUTH & PROJECT ACCESS HELPER ────────────────────────────────────────────

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
    return { allowed: false, notFound: true, project: null, isOwnerOrLead: false };
  }

  if (!userId) {
    return { allowed: true, notFound: false, project, isOwnerOrLead: true };
  }

  const isOwner = project.ownerId === userId;
  const isLead = project.leadId === userId;
  const isProjectMember = project.members.some((m) => m.userId === userId);
  const isOrgMember = project.organization?.members.some((m) => m.userId === userId) ?? false;

  return {
    allowed: isOwner || isLead || isProjectMember || isOrgMember,
    notFound: false,
    project,
    isOwnerOrLead: isOwner || isLead,
  };
}

// ─── PRE-SEEDED DEFAULT CATEGORIES ───────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Client Documents', slug: 'client-documents', icon: 'Briefcase', color: '#3B82F6', position: 0 },
  { name: 'Requirements', slug: 'requirements', icon: 'FileText', color: '#8B5CF6', position: 1 },
  { name: 'Designs & Images', slug: 'designs-images', icon: 'Image', color: '#EC4899', position: 2 },
  { name: 'Reports', slug: 'reports', icon: 'BarChart3', color: '#10B981', position: 3 },
  { name: 'Meeting Notes', slug: 'meeting-notes', icon: 'Calendar', color: '#F59E0B', position: 4 },
  { name: 'Defect Evidence', slug: 'defect-evidence', icon: 'AlertCircle', color: '#EF4444', position: 5 },
  { name: 'Testing Documents', slug: 'testing-documents', icon: 'CheckSquare', color: '#06B6D4', position: 6 },
  { name: 'Whiteboard Exports', slug: 'whiteboard-exports', icon: 'PenTool', color: '#84CC16', position: 7 },
  { name: 'General Files', slug: 'general-files', icon: 'Folder', color: '#6B7280', position: 8 },
];

const DOC_BUILTIN_KEYS = ['docs', 'documents', 'documents.knowledge_base'];
const REPO_SIZE_LIMIT_BYTES = 2147483648; // 2 GB GitHub repo soft limit

interface DocumentModuleScope {
  primarySubmodule: any | null;
  targetSubmodule: any | null;
  isPrimary: boolean;
  submoduleId: number | null;
  submoduleName: string;
  storageMode: 'folder' | 'branch';
  branchName: string;
  pathPrefix: string;
  defaultBranch: string;
  isStorageUnlinked: boolean;
  storageConn: any | null;
  docWhere: Record<string, any>;
  catWhere: Record<string, any>;
}

function parseSubmoduleStorageConfig(rawConfig: string | null | undefined): {
  storageMode?: 'folder' | 'branch';
  folderPath?: string;
  branchName?: string;
} {
  if (!rawConfig || typeof rawConfig !== 'string') return {};
  try {
    const parsed = JSON.parse(rawConfig);
    if (parsed && typeof parsed === 'object') {
      return {
        storageMode: parsed.storageMode === 'branch' ? 'branch' : parsed.storageMode === 'folder' ? 'folder' : undefined,
        folderPath: typeof parsed.folderPath === 'string' ? parsed.folderPath.replace(/^\/+|\/+$/g, '') : undefined,
        branchName: typeof parsed.branchName === 'string' ? parsed.branchName.trim() : undefined,
      };
    }
  } catch {
    // Ignore malformed JSON
  }
  return {};
}

async function resolveDocumentModuleScope(
  projectId: number,
  rawSubmoduleId?: unknown
): Promise<DocumentModuleScope> {
  const [documentSubmodules, storageConn] = await Promise.all([
    prisma.projectSubmodule.findMany({
      where: {
        projectId,
        type: 'built_in',
        builtInKey: { in: DOC_BUILTIN_KEYS },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    }),
  ]);

  const primarySubmodule = documentSubmodules[0] || null;
  const parsedSubId =
    rawSubmoduleId !== undefined && rawSubmoduleId !== null && String(rawSubmoduleId).trim() !== ''
      ? parseInt(String(rawSubmoduleId), 10)
      : NaN;

  const targetSubmodule =
    !Number.isNaN(parsedSubId) && parsedSubId > 0
      ? documentSubmodules.find((s) => s.id === parsedSubId) || null
      : primarySubmodule;

  const isPrimary = !targetSubmodule || !primarySubmodule || targetSubmodule.id === primarySubmodule.id;
  const defaultBranch = storageConn?.defaultBranch || 'main';
  const isStorageUnlinked = storageConn?.connectionStatus === 'unlinked';
  const cfg = parseSubmoduleStorageConfig(targetSubmodule?.config);
  const subSlug = targetSubmodule
    ? GitHubDocumentStorageService.sanitizeSlug(targetSubmodule.name) || `module-${targetSubmodule.id}`
    : 'documents';

  let storageMode: 'folder' | 'branch' = cfg.storageMode || 'folder';
  let branchName = defaultBranch;
  let pathPrefix = 'documents';

  if (isPrimary) {
    storageMode = cfg.storageMode || 'folder';
    branchName = storageMode === 'branch' ? cfg.branchName || defaultBranch : defaultBranch;
    pathPrefix = cfg.folderPath || 'documents';
  } else {
    storageMode = cfg.storageMode === 'branch' ? 'branch' : 'folder';
    branchName = storageMode === 'branch' ? cfg.branchName || `docs/${subSlug}-${targetSubmodule.id}` : defaultBranch;
    pathPrefix =
      storageMode === 'folder'
        ? cfg.folderPath || `modules/${subSlug}-${targetSubmodule.id}`
        : cfg.folderPath || 'documents';
  }

  const scopeFilter = isPrimary
    ? primarySubmodule
      ? { OR: [{ submoduleId: primarySubmodule.id }, { submoduleId: null }] }
      : { submoduleId: null }
    : { submoduleId: targetSubmodule.id };

  return {
    primarySubmodule,
    targetSubmodule,
    isPrimary,
    submoduleId: targetSubmodule?.id ?? null,
    submoduleName: targetSubmodule?.name || 'Documents & Knowledge Base',
    storageMode,
    branchName,
    pathPrefix,
    defaultBranch,
    isStorageUnlinked,
    storageConn,
    docWhere: scopeFilter,
    catWhere: scopeFilter,
  };
}

async function ensureDefaultCategories(
  projectId: number,
  userId?: number | null,
  scope?: DocumentModuleScope
) {
  const catWhere = scope ? { AND: [{ projectId }, scope.catWhere] } : { projectId };
  const count = await (prisma as any).documentCategory.count({ where: catWhere });
  if (count === 0) {
    const slugSuffix =
      scope && scope.targetSubmodule && !scope.isPrimary ? `-s${scope.targetSubmodule.id}` : '';
    for (const cat of DEFAULT_CATEGORIES) {
      await (prisma as any).documentCategory.create({
        data: {
          projectId,
          submoduleId: scope?.targetSubmodule?.id ?? null,
          name: cat.name,
          slug: `${cat.slug}${slugSuffix}`,
          icon: cat.icon,
          color: cat.color,
          position: cat.position,
          createdById: userId || null,
        },
      });
    }
  }
}

// ─── FORMAT DOCUMENT & SHARE HELPERS ─────────────────────────────────────────

function isPdfDocument(doc: any): boolean {
  const mime = (doc?.mimeType || '').toLowerCase();
  const ext = (doc?.extension || doc?.originalName?.split('.').pop() || '').replace(/^\./, '').toLowerCase();
  return mime.includes('pdf') || ext === 'pdf';
}

function formatShareEntry(share: any) {
  if (!share) return null;
  return {
    ...share,
    token: share.tokenHash || share.token || null,
    permission: share.permissionLevel || share.permission || 'view',
    permissionLevel: share.permissionLevel || share.permission || 'view',
    hasPassword: Boolean(share.accessPasswordHash || share.hasPassword),
    message: share.shareMessage ?? share.message ?? null,
    shareMessage: share.shareMessage ?? share.message ?? null,
    allowApproval: Boolean(share.allowApproval),
    approvalStatus: share.approvalStatus || null,
    approvalActorName: share.approvalActorName || null,
    approvalNote: share.approvalNote || null,
    approvalActedAt:
      share.approvalActedAt instanceof Date
        ? share.approvalActedAt.toISOString()
        : share.approvalActedAt || null,
    downloadCount: share.downloadCount || 0,
  };
}

function formatDocument(doc: any) {
  if (!doc) return null;
  const rawExtension = doc.extension || (doc.originalName?.split('.').pop() || '').toLowerCase();
  const cleanExtension = rawExtension.replace(/^\./, '').toLowerCase();
  const fileExtWithDot = cleanExtension ? `.${cleanExtension}` : '';

  let tagsArray: string[] = [];
  if (Array.isArray(doc.tags)) {
    tagsArray = doc.tags;
  } else if (typeof doc.tags === 'string' && doc.tags.trim()) {
    try {
      const parsed = JSON.parse(doc.tags);
      if (Array.isArray(parsed)) tagsArray = parsed;
      else tagsArray = doc.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    } catch {
      tagsArray = doc.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }

  const uploader = doc.uploadedBy || doc.createdBy;
  const displayName = doc.displayName || doc.originalName || 'Untitled Document';
  const originalName = doc.originalName || doc.displayName || 'Untitled Document';

  return {
    ...doc,
    id: doc.id,
    projectId: doc.projectId,
    submoduleId: doc.submoduleId ?? null,
    branch: doc.branch || null,
    categoryId: doc.categoryId ?? null,
    name: displayName,
    displayName: displayName,
    originalName: originalName,
    description: doc.description || null,
    extension: cleanExtension,
    fileExtension: fileExtWithDot,
    mimeType: doc.mimeType || 'application/octet-stream',
    sizeBytes: doc.sizeBytes ?? 0,
    gitHubPath: doc.repositoryPath || doc.gitHubPath || '',
    repositoryPath: doc.repositoryPath || doc.gitHubPath || '',
    gitHubSha: doc.providerFileSha || doc.gitHubSha || null,
    providerFileSha: doc.providerFileSha || doc.gitHubSha || null,
    tags: tagsArray,
    version: doc.version || 1,
    isArchived: doc.deletedAt !== null && doc.deletedAt !== undefined ? true : Boolean(doc.isArchived),
    downloadCount: doc.downloadCount || 0,
    createdById: doc.uploadedById || doc.createdById || 0,
    createdByName: uploader?.name || uploader?.username || 'User',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    category: doc.category || null,
    uploadedBy: uploader || null,
    createdBy: uploader
      ? {
          id: uploader.id,
          name: uploader.name || uploader.username || 'User',
          email: uploader.email || '',
          avatarUrl: uploader.avatarUrl || null,
        }
      : null,
    shares: Array.isArray(doc.shares) ? doc.shares.map(formatShareEntry) : [],
    activities: doc.activities || [],
  };
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

documentsRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const scope = await resolveDocumentModuleScope(projectId, req.query.submoduleId);
    await ensureDefaultCategories(projectId, userId, scope);

    // Combined repository storage size across all submodules and branches
    const allRepoDocs = await (prisma as any).projectDocument.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, sizeBytes: true },
    });
    const repoTotalSizeBytes = allRepoDocs.reduce(
      (acc: number, d: any) => acc + (d.sizeBytes || 0),
      0
    );

    // Fetch non-deleted documents scoped to the current document submodule
    const documents = scope.isStorageUnlinked
      ? []
      : await (prisma as any).projectDocument.findMany({
          where: {
            AND: [{ projectId, deletedAt: null }, scope.docWhere],
          },
          include: {
            category: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatarUrl: true,
                avatarColor: true,
              },
            },
            shares: {
              where: { revokedAt: null },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let moduleSizeBytes = 0;
    let imagesCount = 0;
    let documentsCount = 0;
    let videosCount = 0;
    let othersCount = 0;
    let sharedCount = 0;
    let recentUploadsCount = 0;
    let failedUploadsCount = 0;

    const mimeMap: Record<string, { count: number; sizeBytes: number }> = {};

    documents.forEach((doc: any) => {
      const bytes = doc.sizeBytes || 0;
      moduleSizeBytes += bytes;
      const mime = (doc.mimeType || '').toLowerCase();
      const ext = (doc.extension || '').replace(/^\./, '').toLowerCase();

      const isImage =
        mime.startsWith('image/') ||
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
      const isVideo =
        mime.startsWith('video/') ||
        ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'].includes(ext);
      const isDoc =
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('word') ||
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('presentation') ||
        mime.includes('powerpoint') ||
        mime.startsWith('text/') ||
        ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'].includes(ext);

      let broadType: string;
      if (isImage) {
        imagesCount++;
        broadType = 'Images';
      } else if (isVideo) {
        videosCount++;
        broadType = 'Videos';
      } else if (isDoc) {
        documentsCount++;
        broadType = mime.includes('pdf') || ext === 'pdf' ? 'PDF' : 'Documents';
      } else {
        othersCount++;
        broadType = 'Others';
      }

      if (doc.shares && doc.shares.length > 0) {
        sharedCount++;
      }

      if (new Date(doc.createdAt) >= sevenDaysAgo) {
        recentUploadsCount++;
      }

      if (doc.uploadStatus === 'failed') {
        failedUploadsCount++;
      }

      if (!mimeMap[broadType]) {
        mimeMap[broadType] = { count: 0, sizeBytes: 0 };
      }
      mimeMap[broadType].count += 1;
      mimeMap[broadType].sizeBytes += bytes;
    });

    // Recent activity scoped to this module
    const recentActivities = scope.isStorageUnlinked
      ? []
      : await (prisma as any).documentActivity.findMany({
          where: scope.isPrimary
            ? { projectId }
            : { projectId, document: scope.docWhere },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: { id: true, name: true, username: true, avatarUrl: true, avatarColor: true },
            },
            document: {
              select: { id: true, displayName: true, originalName: true, extension: true, mimeType: true },
            },
          },
        });

    const storageConn = scope.storageConn;

    // Check storage health if configured
    let storageHealth: any = { isHealthy: false, connectionStatus: 'disconnected', error: 'Not configured yet' };
    if (storageConn) {
      storageHealth = await GitHubDocumentStorageService.checkStorageHealth(projectId);
    }

    // Recent active shares scoped to this module
    const recentShares = scope.isStorageUnlinked
      ? []
      : await (prisma as any).documentShare.findMany({
          where: {
            revokedAt: null,
            document: { AND: [{ projectId, deletedAt: null }, scope.docWhere] },
          },
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: {
            document: {
              select: { id: true, displayName: true, originalName: true, extension: true, mimeType: true, sizeBytes: true },
            },
            recipientUser: {
              select: { id: true, name: true, username: true, email: true, avatarUrl: true },
            },
          },
        });

    const approvalShares = scope.isStorageUnlinked
      ? []
      : await (prisma as any).documentShare.findMany({
          where: {
            document: { AND: [{ projectId, deletedAt: null }, scope.docWhere] },
            OR: [{ allowApproval: true }, { approvalStatus: { not: null } }],
          },
          select: { id: true, approvalStatus: true },
        });

    const approvedCount = approvalShares.filter((s: any) => s.approvalStatus === 'approved').length;
    const declinedApprovals = approvalShares.filter((s: any) => s.approvalStatus === 'declined').length;
    const pendingApprovals = approvalShares.filter((s: any) => !s.approvalStatus || s.approvalStatus === 'pending').length;

    const leadUserId = project?.leadId || project?.ownerId;
    const leadUser = leadUserId
      ? await prisma.user.findUnique({ where: { id: leadUserId }, select: { id: true, name: true } })
      : null;

    const formattedDocs = documents.slice(0, 8).map(formatDocument);
    const effectiveTotalSize = scope.isStorageUnlinked ? 0 : repoTotalSizeBytes;

    const categoryCount = scope.isStorageUnlinked
      ? 0
      : await (prisma as any).documentCategory.count({
          where: { AND: [{ projectId }, scope.catWhere] },
        });

    res.json({
      success: true,
      data: {
        isStorageUnlinked: scope.isStorageUnlinked,
        scopeMeta: {
          submoduleId: scope.submoduleId,
          submoduleName: scope.submoduleName,
          isPrimary: scope.isPrimary,
          storageMode: scope.storageMode,
          branchName: scope.branchName,
          pathPrefix: scope.pathPrefix,
        },
        metrics: {
          totalFiles: documents.length,
          totalDocuments: documents.length,
          totalSizeBytes: effectiveTotalSize,
          totalSize: effectiveTotalSize,
          repoTotalSizeBytes: effectiveTotalSize,
          moduleSizeBytes: scope.isStorageUnlinked ? 0 : moduleSizeBytes,
          imagesCount,
          documentsCount,
          videosCount,
          othersCount,
          sharedCount,
          activeShares: sharedCount,
          externalShares: documents.reduce((acc: number, d: any) => acc + (d.shares?.filter((s: any) => s.shareType === 'external_link').length || 0), 0),
          internalShares: documents.reduce((acc: number, d: any) => acc + (d.shares?.filter((s: any) => s.shareType !== 'external_link').length || 0), 0),
          recentUploadsCount,
          failedUploadsCount,
          categoryCount,
          configuredLimitBytes: REPO_SIZE_LIMIT_BYTES,
          approvedCount,
          pendingApprovals,
          declinedApprovals,
        },
        projectMeta: {
          title: project?.title || 'Project Documents',
          status: project?.status || 'active',
          leadName: leadUser?.name || 'Project Lead',
        },
        fileTypeDistribution: Object.entries(mimeMap).map(([type, entry]) => ({
          type,
          label: type,
          count: entry.count,
          sizeBytes: entry.sizeBytes,
          color:
            type === 'Images'
              ? '#3B82F6'
              : type === 'Videos'
              ? '#A855F7'
              : type === 'PDF'
              ? '#EF4444'
              : type === 'Documents'
              ? '#10B981'
              : '#F59E0B',
          percentage: documents.length > 0 ? Math.round((entry.count / documents.length) * 100) : 0,
        })),
        recentFiles: formattedDocs,
        recentDocuments: formattedDocs,
        recentActivities: recentActivities.map((act: any) => ({
          ...act,
          actionLabel:
            act.action === 'upload'
              ? 'Uploaded'
              : act.action === 'delete'
              ? 'Deleted'
              : act.action === 'download'
              ? 'Downloaded'
              : act.action === 'share'
              ? 'Shared'
              : act.action === 'storage_unlinked'
              ? 'Unlinked repository'
              : act.action === 'storage_relinked'
              ? 'Relinked repository'
              : act.action,
          documentName: act.document?.displayName || act.document?.originalName || null,
          actorName: act.actor?.name || act.actor?.username || 'System',
        })),
        recentShares: recentShares.map((s: any) => ({
          ...formatShareEntry(s),
          document: formatDocument(s.document),
        })),
        storageNotice: {
          repositoryName: storageConn?.repositoryName || null,
          repositoryUrl: storageConn?.repositoryUrl || null,
          providerOwner: storageConn?.providerOwner || null,
          defaultBranch: storageConn?.defaultBranch || 'main',
          isPrivate: storageHealth.isPrivate ?? true,
          connectionStatus: storageConn?.connectionStatus || 'disconnected',
          isHealthy: storageHealth.isHealthy,
          lastSyncAt: storageConn?.lastSyncAt || null,
          trackedSizeBytes: effectiveTotalSize,
          configuredLimitBytes: REPO_SIZE_LIMIT_BYTES,
          rateLimitRemaining: storageHealth.rateLimitRemaining,
          rateLimitLimit: storageHealth.rateLimitLimit,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching documents dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── LIST & FILTER DOCUMENTS ─────────────────────────────────────────────────

documentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const {
      tab = 'all',
      categoryId,
      categorySlug,
      submoduleId,
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '25',
    } = req.query;

    const scope = await resolveDocumentModuleScope(projectId, submoduleId);
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    if (scope.isStorageUnlinked) {
      return res.json({
        success: true,
        data: {
          documents: [],
          unlinked: true,
          scopeMeta: {
            submoduleId: scope.submoduleId,
            submoduleName: scope.submoduleName,
            isPrimary: scope.isPrimary,
            storageMode: scope.storageMode,
            branchName: scope.branchName,
            pathPrefix: scope.pathPrefix,
          },
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    const andClauses: any[] = [
      {
        projectId,
        deletedAt: null,
      },
      scope.docWhere,
    ];

    // Tab filtering
    if (tab === 'my_uploads' && userId) {
      andClauses.push({ uploadedById: userId });
    } else if (tab === 'shared') {
      andClauses.push({ shares: { some: { revokedAt: null } } });
    } else if (tab === 'recent') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      andClauses.push({ createdAt: { gte: sevenDaysAgo } });
    }

    // Category filtering
    if (categoryId) {
      andClauses.push({ categoryId: parseInt(categoryId as string, 10) });
    } else if (categorySlug) {
      const category = await (prisma as any).documentCategory.findFirst({
        where: {
          AND: [{ projectId }, scope.catWhere, { slug: categorySlug as string }],
        },
      });
      if (category) {
        andClauses.push({ categoryId: category.id });
      }
    }

    // Type filtering
    if (type && type !== 'all') {
      const t = (type as string).toLowerCase();
      if (t === 'image') {
        andClauses.push({ mimeType: { startsWith: 'image/' } });
      } else if (t === 'pdf') {
        andClauses.push({ mimeType: { contains: 'pdf' } });
      } else if (t === 'video') {
        andClauses.push({ mimeType: { startsWith: 'video/' } });
      } else if (t === 'document') {
        andClauses.push({
          OR: [
            { mimeType: { contains: 'pdf' } },
            { mimeType: { contains: 'word' } },
            { mimeType: { contains: 'text' } },
            { extension: { in: ['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx', 'pptx'] } },
          ],
        });
      } else if (t === 'other') {
        andClauses.push({
          AND: [
            { NOT: { mimeType: { startsWith: 'image/' } } },
            { NOT: { mimeType: { startsWith: 'video/' } } },
            { NOT: { mimeType: { contains: 'pdf' } } },
            { NOT: { mimeType: { contains: 'word' } } },
            { NOT: { mimeType: { startsWith: 'text/' } } },
          ],
        });
      }
    }

    // Search query (ANDed cleanly so it doesn't overwrite type OR)
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      andClauses.push({
        OR: [
          { displayName: { contains: q } },
          { originalName: { contains: q } },
          { description: { contains: q } },
          { tags: { contains: q } },
        ],
      });
    }

    const where = { AND: andClauses };

    // Sorting
    const allowedSortFields = ['createdAt', 'updatedAt', 'displayName', 'sizeBytes'];
    const validSortField = allowedSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [documents, total] = await Promise.all([
      (prisma as any).projectDocument.findMany({
        where,
        include: {
          category: true,
          uploadedBy: {
            select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
          },
          shares: {
            where: { revokedAt: null },
            select: {
              id: true,
              shareType: true,
              tokenHash: true,
              permissionLevel: true,
              accessPasswordHash: true,
              shareMessage: true,
              allowApproval: true,
              approvalStatus: true,
              approvalActorName: true,
              approvalNote: true,
              approvalActedAt: true,
              expiresAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { [validSortField]: validSortOrder },
        skip,
        take: limitNum,
      }),
      (prisma as any).projectDocument.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        documents: documents.map(formatDocument),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error('Error listing documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── LIST PDF APPROVALS ──────────────────────────────────────────────────────

documentsRouter.get('/approvals', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toLowerCase() : 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const scope = await resolveDocumentModuleScope(projectId, req.query.submoduleId);

    if (scope.isStorageUnlinked) {
      return res.json({
        success: true,
        data: {
          approvals: [],
          counts: { total: 0, approved: 0, declined: 0, pending: 0 },
          unlinked: true,
        },
      });
    }

    const shares = await (prisma as any).documentShare.findMany({
      where: {
        document: { AND: [{ projectId, deletedAt: null }, scope.docWhere] },
        OR: [{ allowApproval: true }, { approvalStatus: { not: null } }],
      },
      include: {
        document: {
          include: {
            category: true,
            uploadedBy: {
              select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, username: true, avatarUrl: true, avatarColor: true },
        },
      },
      orderBy: [{ approvalActedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const mapped = shares.map((s: any) => {
      const normalizedStatus = s.approvalStatus || 'pending';
      return {
        id: s.id,
        shareId: s.id,
        documentId: s.documentId,
        token: s.tokenHash || null,
        shareUrl: s.tokenHash ? `/share/documents/${s.tokenHash}` : null,
        isRevoked: Boolean(s.revokedAt),
        revokedAt: s.revokedAt instanceof Date ? s.revokedAt.toISOString() : s.revokedAt || null,
        expiresAt: s.expiresAt instanceof Date ? s.expiresAt.toISOString() : s.expiresAt || null,
        permission: s.permissionLevel || 'view',
        hasPassword: Boolean(s.accessPasswordHash),
        message: s.shareMessage || null,
        allowApproval: Boolean(s.allowApproval),
        approvalStatus: normalizedStatus,
        approvalActorName: s.approvalActorName || null,
        approvalNote: s.approvalNote || null,
        approvalActedAt:
          s.approvalActedAt instanceof Date
            ? s.approvalActedAt.toISOString()
            : s.approvalActedAt || null,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        createdBy: s.createdBy || null,
        document: formatDocument(s.document),
      };
    });

    const counts = {
      total: mapped.length,
      approved: mapped.filter((item: any) => item.approvalStatus === 'approved').length,
      declined: mapped.filter((item: any) => item.approvalStatus === 'declined').length,
      pending: mapped.filter((item: any) => item.approvalStatus === 'pending').length,
    };

    const filtered = mapped.filter((item: any) => {
      if (statusFilter && statusFilter !== 'all' && item.approvalStatus !== statusFilter) {
        return false;
      }
      if (search) {
        const hay = [
          item.document?.name,
          item.document?.originalName,
          item.approvalActorName,
          item.message,
          item.approvalNote,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    res.json({
      success: true,
      data: {
        approvals: filtered,
        counts,
      },
    });
  } catch (error: any) {
    console.error('Error fetching PDF approvals:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── UPLOAD DOCUMENT(S) ──────────────────────────────────────────────────────

documentsRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized to upload documents' });

    const effectiveUserId = userId || project?.ownerId || 390004;

    const { files, categoryId, tags, description, submoduleId } = req.body;
    const scope = await resolveDocumentModuleScope(projectId, submoduleId || req.query.submoduleId);

    if (scope.isStorageUnlinked) {
      return res.status(423).json({
        success: false,
        error:
          'Document storage repository is currently unlinked. Relink the repository in Project Settings > Storage before uploading files.',
      });
    }

    // Validate settings
    const settings = await (prisma as any).documentModuleSettings.findUnique({
      where: { projectId },
    });
    const maxFileSize = settings?.maxFileSizeBytes || 26214400; // 25 MB default
    const duplicatePolicy = req.body.duplicatePolicy || settings?.duplicatePolicy || 'rename'; // 'rename' | 'replace' | 'reject'

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided for upload' });
    }

    const uploaderUser = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { name: true, username: true },
    });
    const uploaderName = uploaderUser?.name || uploaderUser?.username || 'DevFlow User';

    const existingDocsSum = await (prisma as any).projectDocument.findMany({
      where: { projectId, deletedAt: null },
      select: { sizeBytes: true },
    });
    let combinedProjectBytes = existingDocsSum.reduce((acc: number, d: any) => acc + (d.sizeBytes || 0), 0);

    const uploadedDocuments: any[] = [];
    const errors: Array<{ fileName: string; error: string; reason: string }> = [];

    // Ensure category exists or resolve slug
    let defaultCategorySlug: string | undefined;
    if (categoryId) {
      const cat = await (prisma as any).documentCategory.findUnique({
        where: { id: parseInt(categoryId, 10) },
      });
      if (cat) defaultCategorySlug = cat.slug;
    }

    for (const file of files) {
      const name = file.name || file.fileName || file.originalName || 'document';
      const rawBase64 = file.base64 || file.contentBase64 || file.data;
      const mimeType = file.mimeType || file.type || 'application/octet-stream';
      const customDisplayName = file.customDisplayName || file.displayName;
      const targetCategoryId = file.categoryId !== undefined ? file.categoryId : categoryId;
      const targetTags = file.tags !== undefined ? file.tags : tags;
      const targetDescription = file.description !== undefined ? file.description : description;

      if (!name || !rawBase64) {
        const msg = 'Missing file name or data';
        errors.push({ fileName: name || 'unknown', error: msg, reason: msg });
        continue;
      }

      try {
        // Resolve category slug for this specific file
        let fileCategorySlug = defaultCategorySlug;
        if (targetCategoryId && targetCategoryId !== categoryId) {
          const cat = await (prisma as any).documentCategory.findUnique({
            where: { id: parseInt(targetCategoryId, 10) },
          });
          if (cat) fileCategorySlug = cat.slug;
        }

        // Buffer conversion - strip optional data URI scheme if present
        const cleanedBase64 = String(rawBase64).replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanedBase64, 'base64');
        const actualSize = buffer.length;

        // Size check
        if (actualSize > maxFileSize) {
          const maxMB = (maxFileSize / (1024 * 1024)).toFixed(1);
          const msg = `File size (${(actualSize / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit (${maxMB} MB).`;
          errors.push({
            fileName: name,
            error: msg,
            reason: msg,
          });
          continue;
        }

        // Quota check across combined repository (2 GB limit)
        if (combinedProjectBytes + actualSize > REPO_SIZE_LIMIT_BYTES) {
          const msg = `Combined repository storage would exceed the 2 GB GitHub repository limit.`;
          errors.push({ fileName: name, error: msg, reason: msg });
          continue;
        }

        // Handle duplicates within this document submodule scope
        let finalDisplayName = customDisplayName || name;
        let existingSha: string | undefined;

        const existingDoc = await (prisma as any).projectDocument.findFirst({
          where: {
            AND: [{ projectId, deletedAt: null }, scope.docWhere, { displayName: finalDisplayName }],
          },
        });

        if (existingDoc) {
          if (duplicatePolicy === 'reject') {
            const msg = `A document named "${finalDisplayName}" already exists in this module.`;
            errors.push({ fileName: name, error: msg, reason: msg });
            continue;
          } else if (duplicatePolicy === 'replace') {
            existingSha = existingDoc.providerFileSha || undefined;
          } else {
            // rename policy: append timestamp or counter
            const extMatch = name.match(/\.[^.]+$/);
            const ext = extMatch ? extMatch[0] : '';
            const rawName = name.replace(/\.[^.]+$/, '');
            finalDisplayName = `${rawName}_${Date.now()}${ext}`;
          }
        }

        const storageKey = crypto.randomUUID();
        const extension = name.split('.').pop()?.toLowerCase() || '';

        // 1. Upload to GitHub Private Repository (scoped branch + folder path)
        const gitResult = await GitHubDocumentStorageService.uploadDocumentFile({
          projectId,
          projectTitle: project?.title || 'project',
          fileName: name,
          storageKey,
          categorySlug: fileCategorySlug,
          branchName: scope.branchName,
          pathPrefix: scope.pathPrefix,
          contentBuffer: buffer,
          existingSha,
          uploaderName,
        });

        // 2. Save metadata in DevFlow Database
        const docRecord = await (prisma as any).projectDocument.create({
          data: {
            organizationId: project?.organizationId || null,
            projectId,
            submoduleId: scope.targetSubmodule?.id ?? null,
            branch: gitResult.branch || scope.branchName,
            uploadedById: effectiveUserId,
            originalName: name,
            displayName: finalDisplayName,
            storageKey,
            repositoryPath: gitResult.path,
            providerFileSha: gitResult.sha,
            mimeType: mimeType || 'application/octet-stream',
            extension,
            sizeBytes: actualSize,
            categoryId: targetCategoryId ? parseInt(targetCategoryId, 10) : null,
            description: targetDescription || null,
            tags: targetTags ? (Array.isArray(targetTags) ? targetTags.join(',') : targetTags) : null,
            uploadStatus: 'uploaded',
            providerSyncStatus: 'synced',
          },
          include: {
            category: true,
            uploadedBy: {
              select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
            },
          },
        });
        combinedProjectBytes += actualSize;

        // 3. Log Activity
        await (prisma as any).documentActivity.create({
          data: {
            documentId: docRecord.id,
            projectId,
            actorId: effectiveUserId,
            action: 'upload',
            metadata: JSON.stringify({
              fileName: name,
              sizeBytes: actualSize,
              repositoryPath: gitResult.path,
            }),
          },
        });

        uploadedDocuments.push(docRecord);
      } catch (uploadErr: any) {
        console.error(`Error uploading file ${name}:`, uploadErr);
        const errMsg = uploadErr.message || 'Upload failed';
        errors.push({ fileName: name, error: errMsg, reason: errMsg });
      }
    }

    res.json({
      success: uploadedDocuments.length > 0 || (files.length > 0 && errors.length === 0),
      data: {
        uploaded: uploadedDocuments.map(formatDocument),
        errors,
      },
    });
  } catch (error: any) {
    console.error('Error in document upload handler:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET DOCUMENT DETAILS ────────────────────────────────────────────────────

documentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const document = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
        },
        shares: {
          where: { revokedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            recipientUser: {
              select: { id: true, name: true, username: true, email: true, avatarUrl: true },
            },
            createdBy: {
              select: { id: true, name: true },
            },
          },
        },
        activities: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: { id: true, name: true, username: true, avatarUrl: true, avatarColor: true },
            },
          },
        },
        storageConnection: {
          select: { repositoryName: true, repositoryUrl: true, providerOwner: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({ success: true, data: formatDocument(document) });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── STREAM RAW CONTENT (PREVIEW & DOWNLOAD) ─────────────────────────────────

documentsRouter.get('/:id/content', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const document = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });
    if (storageConn?.connectionStatus === 'unlinked') {
      return res.status(423).json({
        success: false,
        error:
          'Document storage repository is unlinked. Relink the repository in Project Settings > Storage to access files.',
      });
    }

    const { download } = req.query;
    const isDownload = download === 'true' || download === '1';

    // Fetch raw content from GitHub Private Repository
    const { buffer, contentType } = await GitHubDocumentStorageService.getDocumentContent({
      projectId,
      repositoryPath: document.repositoryPath,
      branch: document.branch || undefined,
    });

    // Audit log download
    if (isDownload) {
      await (prisma as any).documentActivity.create({
        data: {
          documentId: document.id,
          projectId,
          actorId: userId || null,
          action: 'download',
          metadata: JSON.stringify({ fileName: document.displayName }),
        },
      });
    }

    res.setHeader('Content-Type', document.mimeType || contentType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(document.displayName)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');

    res.send(buffer);
  } catch (error: any) {
    console.error('Error streaming document content:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to stream document content' });
  }
});

// ─── UPDATE METADATA (RENAME, CATEGORY, TAGS) ────────────────────────────────

documentsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const displayName = req.body.displayName || req.body.name;
    const { description, categoryId, tags, visibility } = req.body;

    const existing = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const updated = await (prisma as any).projectDocument.update({
      where: { id: docId },
      data: {
        displayName: displayName?.trim() || existing.displayName,
        description: description !== undefined ? description : existing.description,
        categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId, 10) : null) : existing.categoryId,
        tags: tags !== undefined ? (Array.isArray(tags) ? tags.join(',') : tags) : existing.tags,
        visibility: visibility || existing.visibility,
      },
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
        },
      },
    });

    await (prisma as any).documentActivity.create({
      data: {
        documentId: docId,
        projectId,
        actorId: userId || null,
        action: 'rename',
        metadata: JSON.stringify({
          previousName: existing.displayName,
          newName: updated.displayName,
        }),
      },
    });

    res.json({ success: true, data: formatDocument(updated) });
  } catch (error: any) {
    console.error('Error updating document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DELETE DOCUMENT ─────────────────────────────────────────────────────────

documentsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, isOwnerOrLead } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const document = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Permission check: only uploader or project owner/lead can delete
    if (document.uploadedById !== userId && !isOwnerOrLead) {
      return res.status(403).json({ success: false, error: 'Only the uploader or project lead can delete this document.' });
    }

    const { deleteFromGitHub } = req.query;
    const shouldDeleteFromGitHub = deleteFromGitHub === 'true' || deleteFromGitHub === '1';

    let githubDeleted = false;
    if (shouldDeleteFromGitHub && document.providerFileSha) {
      try {
        githubDeleted = await GitHubDocumentStorageService.deleteDocumentFile({
          projectId,
          repositoryPath: document.repositoryPath,
          fileSha: document.providerFileSha,
          fileName: document.originalName,
          branch: document.branch || undefined,
        });
      } catch (gitErr: any) {
        console.warn('GitHub file deletion encountered error:', gitErr);
      }
    }

    // Hard delete or soft delete
    await (prisma as any).projectDocument.delete({
      where: { id: docId },
    });

    // Log Activity
    await (prisma as any).documentActivity.create({
      data: {
        projectId,
        actorId: userId || null,
        action: 'delete',
        metadata: JSON.stringify({
          documentId: docId,
          fileName: document.displayName,
          deletedFromGitHub: githubDeleted,
        }),
      },
    });

    res.json({
      success: true,
      data: {
        deletedId: docId,
        deletedFromGitHub: githubDeleted,
      },
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── SHARE MANAGEMENT ────────────────────────────────────────────────────────

documentsRouter.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const effectiveUserId = userId || project?.ownerId || 390004;

    const {
      shareType,
      recipientUserId,
      recipientTeamId,
      permissionLevel,
      permission,
      expiresInDays,
      expiresAt: expiresAtInput,
      password,
      message,
      shareMessage,
      allowApproval,
    } = req.body;

    const document = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const wantsApproval = Boolean(allowApproval);
    if (wantsApproval && !isPdfDocument(document)) {
      return res.status(400).json({
        success: false,
        error: 'Approval button workflow is available for PDF files only.',
      });
    }

    const rawMessage = typeof message === 'string' ? message : typeof shareMessage === 'string' ? shareMessage : '';
    const trimmedMessage = rawMessage.trim() ? rawMessage.trim() : null;

    let tokenHash: string | null = null;
    let expiresAt: Date | null = null;
    let accessPasswordHash: string | null = null;

    const isLinkShare =
      wantsApproval ||
      shareType === 'external_link' ||
      shareType === 'public' ||
      shareType === 'internal' ||
      (!recipientUserId && !recipientTeamId);
    const normalizedShareType =
      shareType === 'public' || shareType === 'external_link'
        ? 'external_link'
        : shareType === 'internal'
          ? 'internal_member'
          : shareType || 'internal_member';
    const resolvedPermission = permissionLevel || permission || 'view';

    if (isLinkShare) {
      tokenHash = crypto.randomBytes(24).toString('hex');
      if (expiresAtInput) {
        const parsedExpiry = new Date(expiresAtInput);
        if (!Number.isNaN(parsedExpiry.getTime())) {
          expiresAt = parsedExpiry;
        }
      } else if (expiresInDays && parseInt(expiresInDays, 10) > 0) {
        expiresAt = new Date(Date.now() + parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000);
      }
      if (password && password.trim()) {
        accessPasswordHash = crypto.createHash('sha256').update(password.trim()).digest('hex');
      }
    }

    const share = await (prisma as any).documentShare.create({
      data: {
        documentId: docId,
        shareType: normalizedShareType,
        recipientUserId: recipientUserId ? parseInt(recipientUserId, 10) : null,
        recipientTeamId: recipientTeamId ? parseInt(recipientTeamId, 10) : null,
        tokenHash,
        accessPasswordHash,
        permissionLevel: resolvedPermission,
        shareMessage: trimmedMessage,
        allowApproval: wantsApproval,
        approvalStatus: wantsApproval ? 'pending' : null,
        expiresAt,
        createdById: effectiveUserId,
      },
      include: {
        recipientUser: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    await (prisma as any).documentActivity.create({
      data: {
        documentId: docId,
        projectId,
        actorId: effectiveUserId,
        action: 'share_created',
        metadata: JSON.stringify({
          shareType,
          recipientUserId,
          permissionLevel: resolvedPermission,
          allowApproval: wantsApproval,
          hasMessage: Boolean(trimmedMessage),
          hasToken: Boolean(tokenHash),
        }),
      },
    });

    res.json({
      success: true,
      data: {
        ...formatShareEntry(share),
        shareUrl: tokenHash ? `/share/documents/${tokenHash}` : null,
      },
    });
  } catch (error: any) {
    console.error('Error creating share:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.delete('/:id/share/:shareId', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const docId = parseId(req.params.id);
    const shareId = parseId(req.params.shareId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const existingShare = await (prisma as any).documentShare.findFirst({
      where: { id: shareId, documentId: docId },
    });

    if (!existingShare) {
      return res.status(404).json({ success: false, error: 'Share link not found' });
    }

    if (existingShare.approvalStatus === 'approved' || existingShare.approvalStatus === 'declined') {
      await (prisma as any).documentShare.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
      });
    } else {
      await (prisma as any).documentShare.delete({
        where: { id: shareId },
      });
    }

    await (prisma as any).documentActivity.create({
      data: {
        documentId: docId,
        projectId,
        actorId: userId || null,
        action: 'share_revoked',
        metadata: JSON.stringify({ shareId }),
      },
    });

    res.json({ success: true, data: { revokedShareId: shareId } });
  } catch (error: any) {
    console.error('Error revoking share:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

documentsRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const scope = await resolveDocumentModuleScope(projectId, req.query.submoduleId);
    await ensureDefaultCategories(projectId, userId, scope);

    if (scope.isStorageUnlinked) {
      return res.json({ success: true, data: [] });
    }

    const [categories, docGroups] = await Promise.all([
      (prisma as any).documentCategory.findMany({
        where: { AND: [{ projectId }, scope.catWhere] },
        orderBy: { position: 'asc' },
      }),
      (prisma as any).projectDocument.groupBy({
        by: ['categoryId'],
        where: { AND: [{ projectId, deletedAt: null }, scope.docWhere, { categoryId: { not: null } }] },
        _count: { id: true },
      }),
    ]);

    const countByCatId = new Map<number, number>();
    for (const row of docGroups || []) {
      if (row.categoryId) {
        countByCatId.set(row.categoryId, row._count?.id || 0);
      }
    }

    const formatted = categories.map((c: any) => ({
      ...c,
      _count: { documents: countByCatId.get(c.id) || 0 },
    }));

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.post('/categories', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const { name, icon, color, description, submoduleId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const scope = await resolveDocumentModuleScope(projectId, submoduleId || req.query.submoduleId);
    const slug = GitHubDocumentStorageService.sanitizeSlug(name);
    const count = await (prisma as any).documentCategory.count({
      where: { AND: [{ projectId }, scope.catWhere] },
    });

    const slugSuffix =
      scope.targetSubmodule && !scope.isPrimary ? `-s${scope.targetSubmodule.id}` : '';

    const category = await (prisma as any).documentCategory.create({
      data: {
        projectId,
        submoduleId: scope.targetSubmodule?.id ?? null,
        name: name.trim(),
        slug: `${slug}${slugSuffix}-${Date.now().toString().slice(-4)}`,
        icon: icon || 'Folder',
        color: color || '#6B7280',
        description: description || null,
        position: count,
        createdById: userId || null,
      },
    });

    res.json({ success: true, data: category });
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── STORAGE SETUP, BRANCH STATS & UNLINK/RELINK ─────────────────────────────

documentsRouter.get('/storage', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const [storageConn, health, repoStats, allDocs, docSubmodules] = await Promise.all([
      (prisma as any).projectStorageConnection.findUnique({
        where: { projectId },
        include: {
          providerConnection: {
            select: { accountName: true, accountEmail: true, status: true },
          },
        },
      }),
      GitHubDocumentStorageService.checkStorageHealth(projectId),
      GitHubDocumentStorageService.getRepositoryBranchesAndStats(projectId),
      (prisma as any).projectDocument.findMany({
        where: { projectId, deletedAt: null },
        select: { id: true, sizeBytes: true, branch: true, submoduleId: true },
      }),
      prisma.projectSubmodule.findMany({
        where: {
          projectId,
          type: 'built_in',
          builtInKey: { in: DOC_BUILTIN_KEYS },
        },
        include: {
          module: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const defaultBranch = repoStats.defaultBranch || storageConn?.defaultBranch || 'main';
    const primarySubmodule = docSubmodules[0] || null;
    const totalTrackedBytes = allDocs.reduce((acc: number, d: any) => acc + (d.sizeBytes || 0), 0);

    // Build per-module summary
    const modules = await Promise.all(
      docSubmodules.map(async (sub: any, idx: number) => {
        const subScope = await resolveDocumentModuleScope(projectId, sub.id);
        const docsForSub = allDocs.filter((d: any) =>
          idx === 0
            ? d.submoduleId === sub.id || d.submoduleId === null
            : d.submoduleId === sub.id
        );
        return {
          submoduleId: sub.id,
          submoduleName: sub.name,
          moduleId: sub.moduleId,
          moduleName: sub.module?.name || 'Project Module',
          builtInKey: sub.builtInKey,
          isPrimary: idx === 0,
          storageMode: subScope.storageMode,
          branchName: subScope.branchName,
          folderPath: subScope.pathPrefix,
          fileCount: docsForSub.length,
          sizeBytes: docsForSub.reduce((acc: number, d: any) => acc + (d.sizeBytes || 0), 0),
        };
      })
    );

    // Aggregate tracked docs by branch
    const branchTrackedMap = new Map<
      string,
      { fileCount: number; trackedBytes: number; moduleNames: Set<string> }
    >();
    const moduleNameBySubId = new Map<number, string>();
    docSubmodules.forEach((s: any) => moduleNameBySubId.set(s.id, s.name));

    for (const doc of allDocs) {
      const bName = (doc.branch || '').trim() || defaultBranch;
      if (!branchTrackedMap.has(bName)) {
        branchTrackedMap.set(bName, { fileCount: 0, trackedBytes: 0, moduleNames: new Set() });
      }
      const entry = branchTrackedMap.get(bName)!;
      entry.fileCount += 1;
      entry.trackedBytes += doc.sizeBytes || 0;
      const modLabel =
        (doc.submoduleId && moduleNameBySubId.get(doc.submoduleId)) ||
        primarySubmodule?.name ||
        'Documents';
      entry.moduleNames.add(modLabel);
    }

    const branchMap = new Map<string, any>();
    for (const ghBranch of repoStats.branches) {
      const tracked = branchTrackedMap.get(ghBranch.name);
      branchMap.set(ghBranch.name, {
        name: ghBranch.name,
        commitSha: ghBranch.commitSha,
        isDefault: ghBranch.isDefault,
        protected: ghBranch.protected,
        fileCount: tracked?.fileCount || 0,
        trackedBytes: tracked?.trackedBytes || 0,
        gitHubTreeBytes: ghBranch.gitHubTreeBytes,
        gitHubBlobCount: ghBranch.gitHubBlobCount,
        moduleNames: tracked ? Array.from(tracked.moduleNames) : [],
      });
    }

    // Include any tracked branch not returned in GitHub branch list (e.g. while unlinked)
    for (const [bName, tracked] of branchTrackedMap.entries()) {
      if (!branchMap.has(bName)) {
        branchMap.set(bName, {
          name: bName,
          commitSha: null,
          isDefault: bName === defaultBranch,
          protected: false,
          fileCount: tracked.fileCount,
          trackedBytes: tracked.trackedBytes,
          gitHubTreeBytes: null,
          gitHubBlobCount: null,
          moduleNames: Array.from(tracked.moduleNames),
        });
      }
    }

    const branches = Array.from(branchMap.values()).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.trackedBytes - a.trackedBytes;
    });

    res.json({
      success: true,
      data: {
        storageConnection: storageConn,
        health,
        usage: {
          totalTrackedBytes,
          totalFiles: allDocs.length,
          configuredLimitBytes: REPO_SIZE_LIMIT_BYTES,
          repoGitHubSizeKb: repoStats.repoSizeKb,
          repoGitHubSizeBytes:
            typeof repoStats.repoSizeKb === 'number' ? repoStats.repoSizeKb * 1024 : null,
          isPrivate: repoStats.isPrivate,
        },
        branches,
        modules,
      },
    });
  } catch (error: any) {
    console.error('Error fetching storage status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.get('/storage/repos', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const repos = await GitHubDocumentStorageService.listAccessibleRepositories(projectId);
    res.json({ success: true, data: { repos } });
  } catch (error: any) {
    console.error('Error listing accessible repositories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.post('/storage/unlink', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, isOwnerOrLead } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed || !isOwnerOrLead) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner or lead can unlink document storage.',
      });
    }

    const updated = await GitHubDocumentStorageService.unlinkRepository(projectId);

    await (prisma as any).documentActivity.create({
      data: {
        projectId,
        actorId: userId || null,
        action: 'storage_unlinked',
        metadata: JSON.stringify({
          repositoryName: updated.repositoryName,
          providerOwner: updated.providerOwner,
        }),
      },
    });

    res.json({ success: true, data: { storageConnection: updated } });
  } catch (error: any) {
    console.error('Error unlinking document storage:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

documentsRouter.post('/storage/relink', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, isOwnerOrLead, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed || !isOwnerOrLead) {
      return res.status(403).json({
        success: false,
        error: 'Only the project owner or lead can relink document storage.',
      });
    }

    const { owner, repositoryName, branch } = req.body || {};
    const repoInfo = await GitHubDocumentStorageService.relinkRepository(
      projectId,
      project?.title || 'project',
      { owner, repositoryName, branch }
    );

    await (prisma as any).documentActivity.create({
      data: {
        projectId,
        actorId: userId || null,
        action: 'storage_relinked',
        metadata: JSON.stringify({
          repositoryName: repoInfo.name,
          owner: repoInfo.owner,
          defaultBranch: repoInfo.defaultBranch,
        }),
      },
    });

    res.json({ success: true, data: repoInfo });
  } catch (error: any) {
    console.error('Error relinking document storage:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

documentsRouter.put('/scope-config', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, isOwnerOrLead } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed || !isOwnerOrLead) {
      return res.status(403).json({
        success: false,
        error: 'Only project owner or lead can update submodule storage configuration.',
      });
    }

    const { submoduleId, storageMode, folderPath, branchName } = req.body || {};
    if (!submoduleId) {
      return res.status(400).json({ success: false, error: 'submoduleId is required' });
    }

    const sub = await prisma.projectSubmodule.findFirst({
      where: {
        id: parseInt(String(submoduleId), 10),
        projectId,
        builtInKey: { in: DOC_BUILTIN_KEYS },
      },
    });
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Document submodule not found' });
    }

    const currentCfg = parseSubmoduleStorageConfig(sub.config);
    const nextMode: 'folder' | 'branch' = storageMode === 'branch' ? 'branch' : 'folder';
    const subSlug = GitHubDocumentStorageService.sanitizeSlug(sub.name) || `module-${sub.id}`;

    const nextCfg = {
      ...currentCfg,
      storageMode: nextMode,
      folderPath:
        folderPath !== undefined
          ? String(folderPath).replace(/^\/+|\/+$/g, '')
          : currentCfg.folderPath || (nextMode === 'folder' ? `modules/${subSlug}-${sub.id}` : 'documents'),
      branchName:
        branchName !== undefined
          ? String(branchName).trim()
          : currentCfg.branchName || (nextMode === 'branch' ? `docs/${subSlug}-${sub.id}` : undefined),
    };

    const updatedSub = await prisma.projectSubmodule.update({
      where: { id: sub.id },
      data: {
        config: JSON.stringify(nextCfg),
      },
    });

    // Proactively ensure dedicated branch exists on GitHub if storage is connected
    let branchWarning: string | null = null;
    if (nextMode === 'branch' && nextCfg.branchName) {
      try {
        await GitHubDocumentStorageService.ensureBranchForProject(projectId, nextCfg.branchName);
      } catch (err: any) {
        branchWarning = err.message || 'Could not pre-create branch on GitHub yet; it will be created on first upload.';
      }
    }

    res.json({
      success: true,
      data: {
        submodule: updatedSub,
        config: nextCfg,
        branchWarning,
      },
    });
  } catch (error: any) {
    console.error('Error updating submodule storage config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.post('/storage/setup', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const repoInfo = await GitHubDocumentStorageService.ensureDocumentRepository(
      projectId,
      project?.title || 'project'
    );

    res.json({ success: true, data: repoInfo });
  } catch (error: any) {
    console.error('Error setting up document repository:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── MODULE SETTINGS ─────────────────────────────────────────────────────────

documentsRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    let settings = await (prisma as any).documentModuleSettings.findUnique({
      where: { projectId },
    });

    if (!settings) {
      settings = await (prisma as any).documentModuleSettings.create({
        data: {
          projectId,
          maxFileSizeBytes: 26214400, // 25 MB
          maxFilesPerBatch: 10,
          allowedExtensions: '*',
          allowedMimeTypes: '*',
          duplicatePolicy: 'rename',
          externalSharingEnabled: true,
          providerDeletionEnabled: true,
        },
      });
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

documentsRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, isOwnerOrLead } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed || !isOwnerOrLead) {
      return res.status(403).json({ success: false, error: 'Only project owner or lead can edit settings' });
    }

    const {
      maxFileSizeBytes,
      maxFilesPerBatch,
      allowedExtensions,
      allowedMimeTypes,
      duplicatePolicy,
      externalSharingEnabled,
      providerDeletionEnabled,
      defaultCategoryId,
    } = req.body;

    const updated = await (prisma as any).documentModuleSettings.upsert({
      where: { projectId },
      update: {
        maxFileSizeBytes: maxFileSizeBytes ? parseInt(maxFileSizeBytes, 10) : undefined,
        maxFilesPerBatch: maxFilesPerBatch ? parseInt(maxFilesPerBatch, 10) : undefined,
        allowedExtensions: allowedExtensions !== undefined ? allowedExtensions : undefined,
        allowedMimeTypes: allowedMimeTypes !== undefined ? allowedMimeTypes : undefined,
        duplicatePolicy: duplicatePolicy || undefined,
        externalSharingEnabled: externalSharingEnabled !== undefined ? Boolean(externalSharingEnabled) : undefined,
        providerDeletionEnabled: providerDeletionEnabled !== undefined ? Boolean(providerDeletionEnabled) : undefined,
        defaultCategoryId: defaultCategoryId ? parseInt(defaultCategoryId, 10) : null,
        updatedById: userId || null,
      },
      create: {
        projectId,
        maxFileSizeBytes: maxFileSizeBytes ? parseInt(maxFileSizeBytes, 10) : 26214400,
        maxFilesPerBatch: maxFilesPerBatch ? parseInt(maxFilesPerBatch, 10) : 10,
        allowedExtensions: allowedExtensions || '*',
        allowedMimeTypes: allowedMimeTypes || '*',
        duplicatePolicy: duplicatePolicy || 'rename',
        externalSharingEnabled: externalSharingEnabled !== undefined ? Boolean(externalSharingEnabled) : true,
        providerDeletionEnabled: providerDeletionEnabled !== undefined ? Boolean(providerDeletionEnabled) : true,
        defaultCategoryId: defaultCategoryId ? parseInt(defaultCategoryId, 10) : null,
        updatedById: userId || null,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── STANDALONE PUBLIC SHARE HANDLER ─────────────────────────────────────────

async function resolveValidPublicShare(token: string) {
  if (!token || token === 'undefined' || token === 'null') {
    return { status: 404, error: 'Share link is invalid or has been revoked.' };
  }

  const share = await (prisma as any).documentShare.findUnique({
    where: { tokenHash: token },
    include: {
      createdBy: { select: { id: true, name: true } },
      document: {
        include: {
          project: { select: { id: true, title: true } },
          uploadedBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!share || share.revokedAt || !share.document || share.document.deletedAt) {
    return { status: 404, error: 'Share link is invalid or has been revoked.' };
  }

  const storageConn = await (prisma as any).projectStorageConnection.findUnique({
    where: { projectId: share.document.projectId },
    select: { connectionStatus: true },
  });
  if (storageConn?.connectionStatus === 'unlinked') {
    return {
      status: 423,
      error: 'The document repository for this project has been temporarily unlinked by the administrator.',
    };
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { status: 410, error: 'This share link has expired.' };
  }

  return { share };
}

function buildPublicSharePayload(share: any) {
  const doc = share.document;
  return {
    id: share.id,
    token: share.tokenHash,
    shareType: share.shareType,
    permission: share.permissionLevel || 'view',
    permissionLevel: share.permissionLevel || 'view',
    requiresPassword: Boolean(share.accessPasswordHash),
    isPasswordProtected: Boolean(share.accessPasswordHash),
    message: share.shareMessage || null,
    allowApproval: Boolean(share.allowApproval) && isPdfDocument(doc),
    approvalStatus: share.approvalStatus || null,
    approvalActorName: share.approvalActorName || null,
    approvalNote: share.approvalNote || null,
    approvalActedAt:
      share.approvalActedAt instanceof Date
        ? share.approvalActedAt.toISOString()
        : share.approvalActedAt || null,
    sharedByName: share.createdBy?.name || doc.uploadedBy?.name || 'Team Member',
    expiresAt: share.expiresAt,
    document: {
      id: doc.id,
      name: doc.displayName || doc.originalName,
      displayName: doc.displayName || doc.originalName,
      originalName: doc.originalName,
      fileExtension: doc.extension || '',
      extension: doc.extension || '',
      mimeType: doc.mimeType || 'application/octet-stream',
      sizeBytes: doc.sizeBytes || 0,
      updatedAt: doc.updatedAt,
      projectName: doc.project?.title || 'DevFlow Project',
      uploaderName: doc.uploadedBy?.name || 'Team Member',
    },
  };
}

function isSharePasswordValid(share: any, rawPassword: unknown): boolean {
  if (!share.accessPasswordHash) return true;
  if (typeof rawPassword !== 'string' || !rawPassword.trim()) return false;
  const hashed = crypto.createHash('sha256').update(rawPassword.trim()).digest('hex');
  return hashed === share.accessPasswordHash;
}

async function sendPublicShareFile(
  req: Request,
  res: Response,
  share: any,
  isDownload: boolean,
  password: unknown
) {
  if (share.shareType !== 'external_link' && share.shareType !== 'public') {
    const reqUserId = getUserIdFromToken(req);
    const access = await checkProjectAccess(share.document.projectId, reqUserId);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        error: 'This internal document link requires project member access.',
      });
    }
  }

  if (!isSharePasswordValid(share, password)) {
    return res.status(401).json({
      success: false,
      error: isDownload
        ? 'Valid passphrase required to download this file.'
        : 'Valid passphrase required to access this file.',
    });
  }

  if (isDownload && share.permissionLevel !== 'download' && share.permissionLevel !== 'full') {
    return res.status(403).json({
      success: false,
      error: 'This share link only allows view/preview access.',
    });
  }

  const doc = share.document;
  const fileResult = await GitHubDocumentStorageService.getDocumentContent({
    projectId: doc.projectId,
    repositoryPath: doc.repositoryPath,
    branch: doc.branch || undefined,
  });

  const filename = encodeURIComponent(doc.displayName || doc.originalName || 'document');
  res.setHeader('Content-Type', doc.mimeType || fileResult.contentType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`
  );
  res.setHeader('Cache-Control', 'private, max-age=120');
  return res.send(fileResult.buffer);
}

publicShareRouter.post('/:token/verify', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    const { password } = req.body || {};

    const resolved = await resolveValidPublicShare(token);
    if (!resolved.share) {
      return res.status(resolved.status || 404).json({
        success: false,
        error: resolved.error,
        message: resolved.error,
      });
    }

    const share = resolved.share;
    if (!isSharePasswordValid(share, password)) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect passphrase. Please try again.',
        message: 'Incorrect passphrase. Please try again.',
      });
    }

    return res.json({
      success: true,
      verified: true,
      data: buildPublicSharePayload(share),
    });
  } catch (err: any) {
    console.error('[PublicShare Verify Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to verify share link.',
    });
  }
});

publicShareRouter.post('/:token/respond', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    const { decision, actorName, note, password } = req.body || {};

    const resolved = await resolveValidPublicShare(token);
    if (!resolved.share) {
      return res.status(resolved.status || 404).json({
        success: false,
        error: resolved.error,
        message: resolved.error,
      });
    }

    const share = resolved.share;

    if (share.shareType !== 'external_link' && share.shareType !== 'public') {
      const reqUserId = getUserIdFromToken(req);
      const access = await checkProjectAccess(share.document.projectId, reqUserId);
      if (!access.allowed) {
        return res.status(403).json({
          success: false,
          error: 'This internal document link requires project member access.',
        });
      }
    }

    if (!isSharePasswordValid(share, password)) {
      return res.status(401).json({
        success: false,
        error: 'Valid passphrase required before submitting an approval decision.',
      });
    }

    if (!share.allowApproval || !isPdfDocument(share.document)) {
      return res.status(400).json({
        success: false,
        error: 'Approval responses are only enabled on PDF approval shares.',
      });
    }

    if (decision !== 'approved' && decision !== 'declined') {
      return res.status(400).json({
        success: false,
        error: 'Decision must be either "approved" or "declined".',
      });
    }

    const trimmedName = typeof actorName === 'string' ? actorName.trim() : '';
    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your name (at least 2 characters) before submitting.',
      });
    }

    const trimmedNote = typeof note === 'string' && note.trim() ? note.trim() : null;
    const now = new Date();

    const updated = await (prisma as any).documentShare.update({
      where: { id: share.id },
      data: {
        approvalStatus: decision,
        approvalActorName: trimmedName,
        approvalNote: trimmedNote,
        approvalActedAt: now,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        document: {
          include: {
            project: { select: { id: true, title: true } },
            uploadedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    await (prisma as any).documentActivity.create({
      data: {
        documentId: share.documentId,
        projectId: share.document.projectId,
        actorId: null,
        action: decision === 'approved' ? 'share_approved' : 'share_declined',
        metadata: JSON.stringify({
          shareId: share.id,
          actorName: trimmedName,
          note: trimmedNote,
        }),
      },
    });

    return res.json({
      success: true,
      data: buildPublicSharePayload(updated),
    });
  } catch (err: any) {
    console.error('[PublicShare Respond Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to submit document approval response.',
    });
  }
});

publicShareRouter.get('/:token/content', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    const { download, password } = req.query;

    const resolved = await resolveValidPublicShare(token);
    if (!resolved.share) {
      return res.status(resolved.status || 404).json({
        success: false,
        error: resolved.error,
      });
    }

    const isDownload = download === 'true' || download === '1';
    return await sendPublicShareFile(
      req,
      res,
      resolved.share,
      isDownload,
      typeof password === 'string' ? password : ''
    );
  } catch (err: any) {
    console.error('[PublicShare Content Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to stream shared document content.',
    });
  }
});

publicShareRouter.get('/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    const { download, password } = req.query;

    const resolved = await resolveValidPublicShare(token);
    if (!resolved.share) {
      return res.status(resolved.status || 404).json({
        success: false,
        error: resolved.error,
        message: resolved.error,
      });
    }

    const share = resolved.share;

    // Enforce project access for non-external/internal shares
    if (share.shareType !== 'external_link' && share.shareType !== 'public') {
      const reqUserId = getUserIdFromToken(req);
      const access = await checkProjectAccess(share.document.projectId, reqUserId);
      if (!access.allowed) {
        return res.status(403).json({
          success: false,
          error: 'This internal document link requires project member access.',
          message: 'This internal document link requires project member access.',
        });
      }
    }

    if (download === 'true' || download === '1') {
      return await sendPublicShareFile(
        req,
        res,
        share,
        true,
        typeof password === 'string' ? password : ''
      );
    }

    return res.json({
      success: true,
      data: buildPublicSharePayload(share),
    });
  } catch (err: any) {
    console.error('[PublicShare Info Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to load shared document information.',
    });
  }
});

// Legacy fallback handler retained below
publicShareRouter.get('/legacy/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { download, password } = req.query;

    const share = await (prisma as any).documentShare.findUnique({
      where: { tokenHash: token },
      include: {
        document: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!share || !share.document) {
      return res.status(404).json({ success: false, error: 'Share link not found or expired' });
    }

    if (share.revokedAt) {
      return res.status(410).json({ success: false, error: 'This share link has been revoked.' });
    }

    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return res.status(410).json({ success: false, error: 'This share link has expired.' });
    }

    // Check Password protection
    if (share.accessPasswordHash) {
      const provided = (password as string) || (req.headers['x-share-password'] as string);
      if (!provided) {
        return res.status(401).json({
          success: false,
          requiresPassword: true,
          error: 'This document is password protected.',
          documentInfo: {
            displayName: share.document.displayName,
            sizeBytes: share.document.sizeBytes,
            mimeType: share.document.mimeType,
          },
        });
      }
      const hashedProvided = crypto.createHash('sha256').update(provided.trim()).digest('hex');
      if (hashedProvided !== share.accessPasswordHash) {
        return res.status(403).json({
          success: false,
          requiresPassword: true,
          error: 'Incorrect password.',
        });
      }
    }

    // Metadata only request
    if (req.query.info === 'true') {
      return res.json({
        success: true,
        data: {
          document: {
            id: share.document.id,
            displayName: share.document.displayName,
            sizeBytes: share.document.sizeBytes,
            mimeType: share.document.mimeType,
            extension: share.document.extension,
            createdAt: share.document.createdAt,
            category: share.document.category?.name || 'General',
          },
          permissionLevel: share.permissionLevel,
          expiresAt: share.expiresAt,
        },
      });
    }

    // Permission check for download
    const isDownload = download === 'true' || download === '1';
    if (isDownload && share.permissionLevel === 'view') {
      return res.status(403).json({ success: false, error: 'Download is not permitted for this view-only share link.' });
    }

    // Stream file content from GitHub
    const { buffer, contentType } = await GitHubDocumentStorageService.getDocumentContent({
      projectId: share.document.projectId,
      repositoryPath: share.document.repositoryPath,
    });

    res.setHeader('Content-Type', share.document.mimeType || contentType || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(share.document.displayName)}"`
    );
    res.send(buffer);
  } catch (error: any) {
    console.error('Error accessing public share:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

