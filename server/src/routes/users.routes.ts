import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const usersRouter = Router();

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  let userId: number | undefined;
  if (authHeader && authHeader.includes('_')) {
    const parts = authHeader.split('_');
    const idPart = parts.find((p) => /^\d+$/.test(p));
    if (idPart) userId = parseInt(idPart, 10);
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }

  // Fallback to first user in system
  return await prisma.user.findFirst({ orderBy: { id: 'asc' } });
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name cannot be empty').optional(),
  username: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.replace(/^@+/, '').trim().toLowerCase() : val),
      z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username cannot exceed 30 characters')
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, underscores, dots, and hyphens')
        .optional()
        .nullable()
    )
    .optional(),
  avatarType: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  avatarId: z.string().nullable().optional(),
  avatarColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  isPublicProfile: z.boolean().optional(),
  githubUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
});

// GET /api/users/profile - Get current user profile
usersRouter.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        displayName: user.name,
        username: user.username || `user_${user.id}`,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType || 'initials',
        avatarUrl: user.avatarUrl || '',
        avatarId: user.avatarId || null,
        avatarColor: user.avatarColor || '#8B5CF6',
        accentColor: user.accentColor || '#8B5CF6',
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || 'Female',
        country: user.country || 'US',
        phoneNumber: user.phoneNumber || '',
        jobTitle: user.jobTitle || 'Developer',
        company: user.company || '',
        bio: user.bio || '',
        isPublicProfile: user.isPublicProfile ?? true,
        githubUrl: user.githubUrl || '',
        linkedinUrl: user.linkedinUrl || '',
        websiteUrl: user.websiteUrl || '',
        isEmailVerified: true,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/check-username - Validate and check username availability
usersRouter.get('/check-username', async (req: Request, res: Response) => {
  try {
    const rawInput = (req.query.username as string) || '';
    const username = rawInput.trim().replace(/^@+/, '').toLowerCase();

    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    if (username.length < 3) {
      return res.json({
        success: true,
        available: false,
        message: 'Username must be at least 3 characters',
      });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.json({
        success: true,
        available: false,
        message: 'Letters, numbers, underscores, dots, and hyphens only',
      });
    }

    const currentUser = await getAuthenticatedUser(req);

    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
        },
      },
    });

    // If existing user is current user, it's available
    if (existing && currentUser && existing.id === currentUser.id) {
      return res.json({
        success: true,
        available: true,
        message: `@${username} is your current username`,
      });
    }

    if (existing) {
      return res.json({
        success: true,
        available: false,
        message: `@${username} is already taken`,
      });
    }

    return res.json({
      success: true,
      available: true,
      message: `@${username} is available`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/users/profile - Update current user profile
usersRouter.put('/profile', async (req: Request, res: Response) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.join('.') || 'field';
      let message = firstIssue?.message || 'Validation failed';
      if (message === 'Invalid') {
        message = `Invalid value for ${field}`;
      }
      return res.status(400).json({
        success: false,
        error: message,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const currentUser = await getAuthenticatedUser(req);
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const data = parsed.data;

    // Check if new username conflicts with another user
    if (data.username && data.username.toLowerCase() !== currentUser.username?.toLowerCase()) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username.toLowerCase(),
          id: { not: currentUser.id },
        },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: `Username @${data.username} is already taken by another account.`,
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        name: data.displayName !== undefined ? data.displayName : currentUser.name,
        username: data.username ? data.username.toLowerCase() : currentUser.username,
        avatarType: data.avatarType !== undefined ? data.avatarType : currentUser.avatarType,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : currentUser.avatarUrl,
        avatarId: data.avatarId !== undefined ? data.avatarId : currentUser.avatarId,
        avatarColor: data.avatarColor !== undefined ? data.avatarColor : currentUser.avatarColor,
        accentColor: data.accentColor !== undefined ? data.accentColor : currentUser.accentColor,
        dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : currentUser.dateOfBirth,
        gender: data.gender !== undefined ? data.gender : currentUser.gender,
        country: data.country !== undefined ? data.country : currentUser.country,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : currentUser.phoneNumber,
        jobTitle: data.jobTitle !== undefined ? data.jobTitle : currentUser.jobTitle,
        company: data.company !== undefined ? data.company : currentUser.company,
        bio: data.bio !== undefined ? data.bio : currentUser.bio,
        isPublicProfile:
          data.isPublicProfile !== undefined ? data.isPublicProfile : currentUser.isPublicProfile,
        githubUrl: data.githubUrl !== undefined ? data.githubUrl : currentUser.githubUrl,
        linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : currentUser.linkedinUrl,
        websiteUrl: data.websiteUrl !== undefined ? data.websiteUrl : currentUser.websiteUrl,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        displayName: updated.name,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        avatarType: updated.avatarType,
        avatarUrl: updated.avatarUrl,
        avatarId: updated.avatarId,
        avatarColor: updated.avatarColor,
        accentColor: updated.accentColor,
        dateOfBirth: updated.dateOfBirth,
        gender: updated.gender,
        country: updated.country,
        phoneNumber: updated.phoneNumber,
        jobTitle: updated.jobTitle,
        company: updated.company,
        bio: updated.bio,
        isPublicProfile: updated.isPublicProfile,
        githubUrl: updated.githubUrl,
        linkedinUrl: updated.linkedinUrl,
        websiteUrl: updated.websiteUrl,
        isEmailVerified: true,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

// GET /api/users - List all users (with optional ?search=)
usersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const cleanSearch = rawSearch.replace(/^@+/, '').toLowerCase();

    const where: any = {};
    if (cleanSearch) {
      where.OR = [
        { username: { contains: cleanSearch } },
        { name: { contains: cleanSearch } },
        { email: { contains: cleanSearch } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { projects: true, assignedTasks: true },
        },
      },
    });
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseId(param: string | string[] | undefined): number {
  const str = Array.isArray(param) ? param[0] : param;
  return str ? parseInt(str, 10) : NaN;
}

// GET /api/users/:id - Get user by ID
usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: true,
        assignedTasks: {
          include: { project: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users - Create new user
usersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        avatarUrl: parsed.data.avatarUrl || null,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/users/:id - Delete user
usersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
