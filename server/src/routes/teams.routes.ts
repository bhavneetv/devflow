import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';

export const teamsRouter = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseId(param: string | string[] | undefined): number {
  if (typeof param !== 'string' || !/^\d+$/.test(param)) return NaN;
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 5,
  ADMIN: 4,
  PROJECT_MANAGER: 3,
  DEVELOPER: 2,
  FRONTEND_DEVELOPER: 2,
  BACKEND_DEVELOPER: 2,
  DESIGNER: 2,
  TESTER: 2,
  VIEWER: 1,
};

function canManage(actorRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[actorRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
}

async function getCallerMembership(teamId: number, userId: number) {
  return prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

// ─── Team CRUD ──────────────────────────────────────────────────────────────

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  color: z.string().optional().default('#8B5CF6'),
});

// GET /api/teams — list teams the caller is a member of
teamsRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
            createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const teams = memberships.map((m) => ({
      ...m.team,
      myRole: m.role,
    }));

    res.json({ success: true, data: teams });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams — create a new team
teamsRouter.post('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const parsed = createTeamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation failed' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const team = await prisma.team.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color,
        createdById: userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: {
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ success: true, data: { ...team, myRole: 'OWNER' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:id — full team detail with members & invitations
teamsRouter.get('/:id', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  try {
    const membership = await getCallerMembership(teamId, userId);
    if (!membership) return res.status(403).json({ success: false, error: 'You are not a member of this team' });

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true } },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
      },
    });

    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

    res.json({ success: true, data: { ...team, myRole: membership.role } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
});

// PATCH /api/teams/:id — update team
teamsRouter.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  const membership = await getCallerMembership(teamId, userId);
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return res.status(403).json({ success: false, error: 'Only owners and admins can update the team' });
  }

  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
    const team = await prisma.team.update({
      where: { id: teamId },
      data: parsed.data,
      include: { _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } } },
    });
    res.json({ success: true, data: team });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Members ────────────────────────────────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'DEVELOPER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER', 'DESIGNER', 'PROJECT_MANAGER', 'VIEWER']),
});

// PATCH /api/teams/:id/members/:memberId/role — change member role
teamsRouter.patch('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const targetUserId = parseId(req.params.memberId);
  if (isNaN(teamId) || isNaN(targetUserId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return res.status(403).json({ success: false, error: 'Only owners and admins can change roles' });
    }

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found in team' });

    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot change the role of the team owner' });
    }

    if (!canManage(callerMembership.role, targetMembership.role) || !canManage(callerMembership.role, parsed.data.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to change this member's role" });
    }

    const updated = await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role: parsed.data.role },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:id/members/:memberId — remove member
teamsRouter.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const targetUserId = parseId(req.params.memberId);
  if (isNaN(teamId) || isNaN(targetUserId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);

    // Allow self-removal OR owner/admin removing others
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Not a team member' });

    if (callerId !== targetUserId && !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return res.status(403).json({ success: false, error: 'Only owners and admins can remove members' });
    }

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found' });

    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'The team owner cannot leave or be removed' });
    }

    if (callerId !== targetUserId && !canManage(callerMembership.role, targetMembership.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions to remove this member' });
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Invitations ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'DEVELOPER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER', 'DESIGNER', 'PROJECT_MANAGER', 'VIEWER']).default('DEVELOPER'),
  message: z.string().max(500).optional(),
});

// POST /api/teams/:id/invite — send invitation
teamsRouter.post('/:id/invite', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return res.status(403).json({ success: false, error: 'Only owners and admins can invite members' });
    }

    const { email, role } = parsed.data;

    // Check if email is already a team member
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      const alreadyMember = await getCallerMembership(teamId, existingUser.id);
      if (alreadyMember) {
        return res.status(409).json({ success: false, error: 'This user is already a team member' });
      }
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.teamInvitation.findFirst({
      where: { teamId, invitedEmail: email.toLowerCase(), status: 'PENDING' },
    });
    if (existingInvite) {
      return res.status(409).json({ success: false, error: 'A pending invitation already exists for this email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        invitedById: callerId,
        invitedEmail: email.toLowerCase(),
        assignedRole: role,
        invitationToken: token,
        status: 'PENDING',
        expiresAt,
      },
      include: {
        invitedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: invitation,
      inviteLink: `/invite/${token}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:id/invitations/:invId/resend — resend invitation
teamsRouter.post('/:id/invitations/:invId/resend', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const invId = parseId(req.params.invId);
  if (isNaN(teamId) || isNaN(invId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const invite = await prisma.teamInvitation.findFirst({
      where: { id: invId, teamId, status: 'PENDING' },
    });
    if (!invite) return res.status(404).json({ success: false, error: 'Invitation not found' });

    const newToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.teamInvitation.update({
      where: { id: invId },
      data: { invitationToken: newToken, expiresAt, createdAt: new Date() },
      include: {
        invitedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    res.json({ success: true, data: updated, inviteLink: `/invite/${newToken}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:id/invitations/:invId — cancel invitation
teamsRouter.delete('/:id/invitations/:invId', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const invId = parseId(req.params.invId);
  if (isNaN(teamId) || isNaN(invId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invId, teamId, status: 'PENDING' } });
    if (!invitation) return res.status(404).json({ success: false, error: 'Pending invitation not found' });

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, message: 'Invitation cancelled' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Public Invitation Accept Flow ──────────────────────────────────────────

// GET /api/teams/invitations/:token — validate token (public)
teamsRouter.get('/invitations/:token', async (req: Request, res: Response) => {
  try {
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const invitation = await prisma.teamInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        team: { select: { id: true, name: true, description: true, color: true } },
        invitedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    if (!invitation) return res.status(404).json({ success: false, error: 'Invalid invitation link' });

    if (invitation.status !== 'PENDING') {
      return res.status(410).json({ success: false, error: `This invitation has already been ${invitation.status.toLowerCase()}`, status: invitation.status });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      return res.status(410).json({ success: false, error: 'This invitation has expired', status: 'EXPIRED' });
    }

    res.json({
      success: true,
      data: {
        id: invitation.id,
        invitedEmail: invitation.invitedEmail,
        assignedRole: invitation.assignedRole,
        expiresAt: invitation.expiresAt,
        team: invitation.team,
        invitedBy: invitation.invitedBy,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/invitations/:token/accept — accept invitation
teamsRouter.post('/invitations/:token/accept', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'You must be logged in to accept an invitation' });

  try {
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const invitation = await prisma.teamInvitation.findUnique({
      where: { invitationToken: token },
      include: { team: true },
    });

    if (!invitation) return res.status(404).json({ success: false, error: 'Invalid invitation' });
    if (invitation.status !== 'PENDING') {
      return res.status(410).json({ success: false, error: `Invitation is ${invitation.status.toLowerCase()}` });
    }
    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      return res.status(410).json({ success: false, error: 'Invitation has expired' });
    }

    // Verify email matches
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `This invitation was sent to ${invitation.invitedEmail}. Please log in with that account.`,
      });
    }

    // Check not already a member
    const existing = await getCallerMembership(invitation.teamId, userId);
    if (existing) {
      // Mark invitation accepted even if already member
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return res.json({ success: true, message: 'You are already a member of this team', teamId: invitation.teamId });
    }

    // Add to team and mark accepted — transactionally
    await prisma.$transaction([
      prisma.teamMember.create({
        data: { teamId: invitation.teamId, userId, role: invitation.assignedRole },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    res.json({ success: true, message: 'You have joined the team!', teamId: invitation.teamId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/invitations/:token/decline — decline invitation
teamsRouter.post('/invitations/:token/decline', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const invitation = await prisma.teamInvitation.findUnique({ where: { invitationToken: token } });

    if (!invitation || invitation.status !== 'PENDING') {
      return res.status(404).json({ success: false, error: 'Invitation not found or already processed' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Email mismatch' });
    }

    await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'DECLINED' } });

    res.json({ success: true, message: 'Invitation declined' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
