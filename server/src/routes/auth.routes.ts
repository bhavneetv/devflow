import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { syncPendingInvitationsForUser } from './notifications.routes.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// GET /api/auth/register - Informative helper for direct browser hits
authRouter.get('/register', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'DevFlow registration API endpoint is active. Submit a POST request with name, email, and password to register.',
  });
});

// GET /api/auth/login - Informative helper for direct browser hits
authRouter.get('/login', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'DevFlow login API endpoint is active. Submit a POST request with email and password to log in.',
  });
});

// Helper to guarantee a collision-free username
async function generateUniqueUsername(baseHandle: string): Promise<string> {
  let clean = (baseHandle || '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_.-]/g, '_')
    .slice(0, 24);

  if (clean.length < 3) clean = `user_${Date.now().toString().slice(-4)}`;

  let candidate = clean;
  let counter = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${clean.slice(0, 20)}${counter}`;
    counter++;
  }
  return candidate;
}

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    // Artificial short delay to simulate secure credential verification
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Lookup user in MySQL
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        _count: {
          select: { projects: true, assignedTasks: true },
        },
      },
    });

    if (!user) {
      // New user detected in signin flow! Auto-provision initial account with onboardingCompleted: false
      const namePart = email.split('@')[0].replace(/[._-]/g, ' ');
      const formattedName = namePart
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      const rawHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
      const uniqueUsername = await generateUniqueUsername(rawHandle);

      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: formattedName || 'New Developer',
          username: uniqueUsername,
          role: 'MEMBER',
          onboardingCompleted: false,
          avatarType: 'initials',
          avatarColor: '#8B5CF6',
          accentColor: '#8B5CF6',
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName || 'New Developer')}`,
        },
      });

      const token = `devflow_session_${newUser.id}_${Date.now()}`;
      syncPendingInvitationsForUser(newUser.id, newUser.email).catch((e) => console.error(e));

      return res.json({
        success: true,
        token,
        isNewUser: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          avatarType: newUser.avatarType || 'initials',
          avatarUrl: newUser.avatarUrl,
          avatarId: newUser.avatarId,
          avatarColor: newUser.avatarColor || '#8B5CF6',
          accentColor: newUser.accentColor || '#8B5CF6',
          onboardingCompleted: false,
        },
      });
    }

    const token = `devflow_session_${user.id}_${Date.now()}`;
    const isNewUser = !user.onboardingCompleted;

    syncPendingInvitationsForUser(user.id, user.email).catch((e) => console.error(e));

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType || 'initials',
        avatarUrl: user.avatarUrl,
        avatarId: user.avatarId,
        avatarColor: user.avatarColor || '#8B5CF6',
        accentColor: user.accentColor || '#8B5CF6',
        onboardingCompleted: user.onboardingCompleted,
        _count: (user as any)._count,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Authentication failed. Please try again.',
    });
  }
});

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Validation failed',
      });
    }

    const { name, email } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const rawHandle = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    const uniqueUsername = await generateUniqueUsername(rawHandle);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        username: uniqueUsername,
        role: 'MEMBER',
        onboardingCompleted: false,
        avatarType: 'initials',
        avatarColor: '#8B5CF6',
        accentColor: '#8B5CF6',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    const token = `devflow_session_${user.id}_${Date.now()}`;

    syncPendingInvitationsForUser(user.id, user.email).catch((e) => console.error(e));

    res.status(201).json({
      success: true,
      token,
      isNewUser: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl,
        avatarId: user.avatarId,
        avatarColor: user.avatarColor,
        accentColor: user.accentColor,
        onboardingCompleted: false,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/social
authRouter.post('/social', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;

    if (!['github', 'google'].includes(provider)) {
      return res.status(400).json({ success: false, error: 'Invalid OAuth provider' });
    }

    // Simulate provider handshake
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Return or link existing user
    let user = await prisma.user.findFirst({
      where: { email: `${provider}.developer@devflow.io` },
    });

    const isNewUser = !user || !user.onboardingCompleted;

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: provider === 'github' ? 'GitHub Developer' : 'Google Developer',
          email: `${provider}.developer@devflow.io`,
          username: `${provider}_dev_${Date.now().toString().slice(-4)}`,
          role: 'ADMIN',
          onboardingCompleted: false,
          avatarType: 'initials',
          avatarColor: '#8B5CF6',
          accentColor: '#8B5CF6',
          avatarUrl:
            provider === 'github'
              ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
              : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        },
      });
    }

    const token = `devflow_oauth_${provider}_${user.id}_${Date.now()}`;

    res.json({
      success: true,
      provider,
      token,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType || 'initials',
        avatarUrl: user.avatarUrl,
        avatarId: user.avatarId,
        avatarColor: user.avatarColor || '#8B5CF6',
        accentColor: user.accentColor || '#8B5CF6',
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let userId: number | undefined;
    if (authHeader.includes('_')) {
      const parts = authHeader.split('_');
      const idPart = parts.find((p) => /^\d+$/.test(p));
      if (idPart) userId = parseInt(idPart, 10);
    }

    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findFirst({ orderBy: { id: 'asc' } });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType || 'initials',
        avatarUrl: user.avatarUrl,
        avatarId: user.avatarId,
        avatarColor: user.avatarColor || '#8B5CF6',
        accentColor: user.accentColor || '#8B5CF6',
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const onboardingSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  username: z.string().optional(),
  avatarType: z.enum(['preset', 'upload', 'initials', 'icon']).default('initials'),
  avatarId: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  avatarColor: z.string().default('#7C3AED'),
  accentColor: z.string().default('#8B5CF6'),
  role: z.string().nullable().optional(),
  workspaceType: z.string().nullable().optional(),
  goals: z.array(z.string()).default([]),
  teamSizePreference: z.string().nullable().optional(),
  startingPreference: z.enum(['new_project', 'github_import', 'sample']).nullable().optional(),
  projectName: z.string().nullable().optional(),
  projectDescription: z.string().nullable().optional(),
});

// POST /api/auth/onboarding
authRouter.post('/onboarding', async (req: Request, res: Response) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid onboarding data',
      });
    }

    const data = parsed.data;

    // Simulate backend provisioning step (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get user from token header or find first user
    const authHeader = req.headers.authorization;
    let userId: number | undefined;
    if (authHeader && authHeader.includes('_')) {
      const parts = authHeader.split('_');
      const idPart = parts.find((p) => /^\d+$/.test(p));
      if (idPart) userId = parseInt(idPart, 10);
    }

    let user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findFirst({ orderBy: { id: 'asc' } });

    const targetUsername = data.username
      ? data.username.toLowerCase().replace(/^@+/, '').trim()
      : undefined;

    if (targetUsername) {
      if (targetUsername.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Username must be at least 3 characters',
        });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(targetUsername)) {
        return res.status(400).json({
          success: false,
          error: 'Letters, numbers, underscores, dots, and hyphens only',
        });
      }

      const existingUserWithUsername = await prisma.user.findFirst({
        where: {
          username: {
            equals: targetUsername,
          },
        },
      });

      if (existingUserWithUsername && (!user || existingUserWithUsername.id !== user.id)) {
        return res.status(409).json({
          success: false,
          error: `@${targetUsername} is already taken by another developer. Please choose a different username.`,
        });
      }
    }

    if (!user) {
      const finalUsername = targetUsername || (await generateUniqueUsername(data.displayName));
      user = await prisma.user.create({
        data: {
          name: data.displayName,
          username: finalUsername,
          email: `${data.displayName.toLowerCase().replace(/\s+/g, '.')}@devflow.io`,
          role: 'ADMIN',
          avatarType: data.avatarType,
          avatarId: data.avatarId,
          avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.displayName)}`,
          avatarColor: data.avatarColor,
          accentColor: data.accentColor,
          onboardingCompleted: true,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: data.displayName,
          username: targetUsername || user.username,
          avatarType: data.avatarType,
          avatarId: data.avatarId,
          avatarUrl: data.avatarUrl || user.avatarUrl,
          avatarColor: data.avatarColor,
          accentColor: data.accentColor,
          onboardingCompleted: true,
        },
      });
    }

    // If user chose to create a new project with a name, create it!
    if (data.startingPreference === 'new_project' && data.projectName?.trim()) {
      await prisma.project.create({
        data: {
          title: data.projectName.trim(),
          description: data.projectDescription?.trim() || 'Created during DevFlow onboarding',
          status: 'IN_PROGRESS',
          ownerId: user.id,
        },
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl,
        avatarId: user.avatarId,
        avatarColor: user.avatarColor,
        accentColor: user.accentColor,
        onboardingCompleted: true,
      },
      onboarding: data,
    });
  } catch (error: any) {
    console.error('Onboarding save error:', error);
    if (error?.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'This username is already taken. Please choose another username.',
      });
    }
    res.status(500).json({ success: false, error: error?.message || 'Onboarding failed' });
  }
});

// POST /api/auth/demo-new-user (creates/logs in a test new user to experience onboarding)
authRouter.post('/demo-new-user', async (_req: Request, res: Response) => {
  try {
    const email = 'new.developer@devflow.io';
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Alex Rivers',
          email,
          role: 'MEMBER',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        },
      });
    }

    const token = `devflow_session_${user.id}_${Date.now()}`;

    res.json({
      success: true,
      token,
      user,
      isNewUser: true,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

