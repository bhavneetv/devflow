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

async function ensureDefaultCategories(projectId: number, userId?: number | null) {
  const count = await (prisma as any).documentCategory.count({ where: { projectId } });
  if (count === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await (prisma as any).documentCategory.create({
        data: {
          projectId,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          color: cat.color,
          position: cat.position,
          createdById: userId || null,
        },
      });
    }
  }
}

// ─── FORMAT DOCUMENT HELPER ──────────────────────────────────────────────────

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
    shares: doc.shares || [],
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

    await ensureDefaultCategories(projectId, userId);

    // Fetch non-deleted documents
    const documents = await (prisma as any).projectDocument.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      include: {
        category: true,
        uploadedBy: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true, avatarColor: true },
        },
        shares: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalSizeBytes = 0;
    let imagesCount = 0;
    let documentsCount = 0;
    let videosCount = 0;
    let sharedCount = 0;
    let recentUploadsCount = 0;
    let failedUploadsCount = 0;

    const mimeMap: Record<string, number> = {};

    documents.forEach((doc: any) => {
      totalSizeBytes += doc.sizeBytes || 0;
      const mime = (doc.mimeType || '').toLowerCase();
      const ext = (doc.extension || '').toLowerCase();

      if (mime.startsWith('image/')) {
        imagesCount++;
      } else if (mime.startsWith('video/') || mime.startsWith('audio/')) {
        videosCount++;
      } else if (
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('word') ||
        mime.includes('text') ||
        ['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)
      ) {
        documentsCount++;
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

      const broadType = mime.startsWith('image/')
        ? 'Images'
        : mime.includes('pdf')
        ? 'PDF'
        : mime.startsWith('video/') || mime.startsWith('audio/')
        ? 'Media'
        : ['zip', 'tar', 'gz', 'rar'].includes(ext)
        ? 'Archives'
        : ['js', 'ts', 'py', 'json', 'html', 'css'].includes(ext)
        ? 'Code'
        : 'Documents';

      mimeMap[broadType] = (mimeMap[broadType] || 0) + 1;
    });

    // Recent activity
    const recentActivities = await (prisma as any).documentActivity.findMany({
      where: { projectId },
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

    // Storage Connection Status & Notice Data
    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
    });

    // Check storage health if configured
    let storageHealth: any = { isHealthy: false, error: 'Not configured yet' };
    if (storageConn) {
      storageHealth = await GitHubDocumentStorageService.checkStorageHealth(projectId);
    }

    // Recent active shares
    const recentShares = await (prisma as any).documentShare.findMany({
      where: { document: { projectId, deletedAt: null } },
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

    const formattedDocs = documents.slice(0, 8).map(formatDocument);

    res.json({
      success: true,
      data: {
        metrics: {
          totalFiles: documents.length,
          totalDocuments: documents.length,
          totalSizeBytes,
          totalSize: totalSizeBytes,
          imagesCount,
          documentsCount,
          videosCount,
          sharedCount,
          activeShares: sharedCount,
          externalShares: documents.reduce((acc: number, d: any) => acc + (d.shares?.filter((s: any) => s.shareType === 'external_link').length || 0), 0),
          internalShares: documents.reduce((acc: number, d: any) => acc + (d.shares?.filter((s: any) => s.shareType !== 'external_link').length || 0), 0),
          recentUploadsCount,
          failedUploadsCount,
          categoryCount: await (prisma as any).documentCategory.count({ where: { projectId } }),
          configuredLimitBytes: 26214400, // 25 MB default
        },
        fileTypeDistribution: Object.entries(mimeMap).map(([type, count]) => ({
          type,
          label: type,
          count,
          sizeBytes: 0,
          color: '#3B82F6',
          percentage: documents.length > 0 ? Math.round((count / documents.length) * 100) : 0,
        })),
        recentFiles: formattedDocs,
        recentDocuments: formattedDocs,
        recentActivities,
        recentShares: recentShares.map((s: any) => ({
          ...s,
          document: formatDocument(s.document),
        })),
        storageNotice: {
          repositoryName: storageConn?.repositoryName || null,
          repositoryUrl: storageConn?.repositoryUrl || null,
          providerOwner: storageConn?.providerOwner || null,
          isPrivate: storageHealth.isPrivate ?? true,
          connectionStatus: storageConn?.connectionStatus || 'disconnected',
          isHealthy: storageHealth.isHealthy,
          lastSyncAt: storageConn?.lastSyncAt || null,
          trackedSizeBytes: totalSizeBytes,
          configuredLimitBytes: 26214400, // 25 MB default
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
      type,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '25',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      projectId,
      deletedAt: null,
    };

    // Tab filtering
    if (tab === 'my_uploads' && userId) {
      where.uploadedById = userId;
    } else if (tab === 'shared') {
      where.shares = { some: {} };
    } else if (tab === 'recent') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: sevenDaysAgo };
    }

    // Category filtering
    if (categoryId) {
      where.categoryId = parseInt(categoryId as string, 10);
    } else if (categorySlug) {
      const category = await (prisma as any).documentCategory.findUnique({
        where: { projectId_slug: { projectId, slug: categorySlug as string } },
      });
      if (category) {
        where.categoryId = category.id;
      }
    }

    // Type filtering
    if (type && type !== 'all') {
      const t = (type as string).toLowerCase();
      if (t === 'image') {
        where.mimeType = { startsWith: 'image/' };
      } else if (t === 'pdf') {
        where.mimeType = { contains: 'pdf' };
      } else if (t === 'video') {
        where.mimeType = { startsWith: 'video/' };
      } else if (t === 'document') {
        where.OR = [
          { mimeType: { contains: 'pdf' } },
          { mimeType: { contains: 'word' } },
          { mimeType: { contains: 'text' } },
          { extension: { in: ['pdf', 'doc', 'docx', 'txt', 'md', 'xlsx', 'pptx'] } },
        ];
      }
    }

    // Search query
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { displayName: { contains: q } },
        { originalName: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
      ];
    }

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
            select: { id: true, shareType: true, permissionLevel: true, expiresAt: true },
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

// ─── UPLOAD DOCUMENT(S) ──────────────────────────────────────────────────────

documentsRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound, project } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized to upload documents' });

    const effectiveUserId = userId || project?.ownerId || 390004;

    // Validate settings
    const settings = await (prisma as any).documentModuleSettings.findUnique({
      where: { projectId },
    });
    const maxFileSize = settings?.maxFileSizeBytes || 26214400; // 25 MB default
    const duplicatePolicy = req.body.duplicatePolicy || settings?.duplicatePolicy || 'rename'; // 'rename' | 'replace' | 'reject'

    const { files, categoryId, tags, description } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided for upload' });
    }

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

        // Handle duplicates
        let finalDisplayName = customDisplayName || name;
        let existingSha: string | undefined;

        const existingDoc = await (prisma as any).projectDocument.findFirst({
          where: {
            projectId,
            displayName: finalDisplayName,
            deletedAt: null,
          },
        });

        if (existingDoc) {
          if (duplicatePolicy === 'reject') {
            const msg = `A document named "${finalDisplayName}" already exists.`;
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

        // 1. Upload to GitHub Private Repository
        const gitResult = await GitHubDocumentStorageService.uploadDocumentFile({
          projectId,
          projectTitle: project?.title || 'project',
          fileName: name,
          storageKey,
          categorySlug: fileCategorySlug,
          contentBuffer: buffer,
          existingSha,
        });

        // 2. Save metadata in DevFlow Database
        const docRecord = await (prisma as any).projectDocument.create({
          data: {
            organizationId: project?.organizationId || null,
            projectId,
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

    const { download } = req.query;
    const isDownload = download === 'true' || download === '1';

    // Fetch raw content from GitHub Private Repository
    const { buffer, contentType } = await GitHubDocumentStorageService.getDocumentContent({
      projectId,
      repositoryPath: document.repositoryPath,
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

    const { shareType, recipientUserId, recipientTeamId, permissionLevel, expiresInDays, password } = req.body;

    const document = await (prisma as any).projectDocument.findFirst({
      where: { id: docId, projectId, deletedAt: null },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    let tokenHash: string | null = null;
    let expiresAt: Date | null = null;
    let accessPasswordHash: string | null = null;

    if (shareType === 'external_link') {
      tokenHash = crypto.randomBytes(24).toString('hex');
      if (expiresInDays && parseInt(expiresInDays, 10) > 0) {
        expiresAt = new Date(Date.now() + parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000);
      }
      if (password && password.trim()) {
        accessPasswordHash = crypto.createHash('sha256').update(password.trim()).digest('hex');
      }
    }

    const share = await (prisma as any).documentShare.create({
      data: {
        documentId: docId,
        shareType: shareType || 'internal_member',
        recipientUserId: recipientUserId ? parseInt(recipientUserId, 10) : null,
        recipientTeamId: recipientTeamId ? parseInt(recipientTeamId, 10) : null,
        tokenHash,
        accessPasswordHash,
        permissionLevel: permissionLevel || 'view',
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
          permissionLevel,
          hasToken: Boolean(tokenHash),
        }),
      },
    });

    res.json({
      success: true,
      data: {
        ...share,
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

    await (prisma as any).documentShare.delete({
      where: { id: shareId },
    });

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

    await ensureDefaultCategories(projectId, userId);

    const categories = await (prisma as any).documentCategory.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { position: 'asc' },
    });

    res.json({ success: true, data: categories });
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

    const { name, icon, color, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const slug = GitHubDocumentStorageService.sanitizeSlug(name);
    const count = await (prisma as any).documentCategory.count({ where: { projectId } });

    const category = await (prisma as any).documentCategory.create({
      data: {
        projectId,
        name: name.trim(),
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
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

// ─── STORAGE SETUP & CONNECTION STATUS ───────────────────────────────────────

documentsRouter.get('/storage', async (req: Request, res: Response) => {
  try {
    const projectId = parseId(req.params.projectId);
    const userId = getUserIdFromToken(req);
    const { allowed, notFound } = await checkProjectAccess(projectId, userId);
    if (notFound) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!allowed) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const storageConn = await (prisma as any).projectStorageConnection.findUnique({
      where: { projectId },
      include: {
        providerConnection: {
          select: { accountName: true, accountEmail: true, status: true },
        },
      },
    });

    const health = await GitHubDocumentStorageService.checkStorageHealth(projectId);

    res.json({
      success: true,
      data: {
        storageConnection: storageConn,
        health,
      },
    });
  } catch (error: any) {
    console.error('Error fetching storage status:', error);
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

publicShareRouter.get('/:token', async (req: Request, res: Response) => {
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

