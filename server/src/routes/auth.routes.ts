import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

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
    await new Promise((resolve) => setTimeout(resolve, 600));

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
      // If user is testing demo credentials like alice@devflow.io or any seeded user, or creating initial account
      return res.status(401).json({
        success: false,
        error: 'No account found with this email address. Please register or use a demo account.',
      });
    }

    // In a production app, verify bcrypt hash. For development/demo, generate token:
    const token = `devflow_session_${user.id}_${Date.now()}`;

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        _count: user._count,
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

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        role: 'MEMBER',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    const token = `devflow_session_${user.id}_${Date.now()}`;

    res.status(201).json({
      success: true,
      token,
      user,
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
    await new Promise((resolve) => setTimeout(resolve, 750));

    // Return or link existing user (e.g. Alice Johnson) or provider profile
    let user = await prisma.user.findFirst({
      where: { email: 'alice@devflow.io' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: provider === 'github' ? 'GitHub Developer' : 'Google Developer',
          email: `${provider}.developer@devflow.io`,
          role: 'ADMIN',
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
      user,
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

    // Default to first user if token exists
    const user = await prisma.user.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
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

    // Simulate backend provisioning step (1s)
    await new Promise((resolve) => setTimeout(resolve, 800));

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

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: data.displayName,
          email: `${data.displayName.toLowerCase().replace(/\s+/g, '.')}@devflow.io`,
          role: 'ADMIN',
          avatarUrl: data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.displayName)}`,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: data.displayName,
          avatarUrl: data.avatarUrl || user.avatarUrl,
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
      user,
      onboarding: data,
    });
  } catch (error: any) {
    console.error('Onboarding save error:', error);
    res.status(500).json({ success: false, error: error.message });
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

