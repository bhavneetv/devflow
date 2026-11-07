import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { sendTeamInvitationEmail, sendInvitationDecisionEmail } from '../lib/email.service.js';
import { emitToTeam, emitToUser } from '../lib/socket.js';

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
    include: { permissions: true },
  });
}

export type TeamPermissionKey =
  | 'manageTeamMembers'
  | 'removeTeamMembers'
  | 'manageMemberRoles'
  | 'manageTeamDetails'
  | 'manageTeamSettings'
  | 'manageInvitations';

async function hasTeamPermission(
  teamId: number,
  userId: number,
  permission: TeamPermissionKey
): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { permissions: true },
  });
  if (!member) return false;

  // The Team Owner always retains full permissions
  if (member.role === 'OWNER') return true;

  // If specific permission configuration exists, use it
  const perm = Array.isArray(member.permissions) ? member.permissions[0] : (member.permissions as any);
  if (perm) {
    return Boolean((perm as any)[permission]);
  }

  // Default permissions if not yet configured: ADMIN has all, others have none
  if (member.role === 'ADMIN') {
    return true;
  }

  return false;
}

const USER_SELECT_FIELDS = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatarUrl: true,
  avatarColor: true,
  avatarType: true,
  avatarId: true,
  createdAt: true,
};

// ─── Team CRUD ──────────────────────────────────────────────────────────────

const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Team name must be at least 2 characters')
    .max(80, 'Team name cannot exceed 80 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  color: z.string().optional().default('#8B5CF6'),
  organizationId: z.number().int().positive().optional(),
  organizationSlug: z.string().optional(),
  memberIds: z.array(z.number()).optional(),
  members: z
    .array(
      z.object({
        userId: z.number(),
        role: z
          .enum([
            'ADMIN',
            'DEVELOPER',
            'FRONTEND_DEVELOPER',
            'BACKEND_DEVELOPER',
            'TESTER',
            'DESIGNER',
            'PROJECT_MANAGER',
            'VIEWER',
          ])
          .optional(),
      })
    )
    .optional(),
});

// GET /api/teams — list teams the caller is a member of (optional organization filter)
teamsRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  let orgFilterId: number | undefined;
  if (req.query.organizationId) {
    const parsedOrgId = parseInt(req.query.organizationId as string, 10);
    if (!isNaN(parsedOrgId)) orgFilterId = parsedOrgId;
  } else if (req.query.organizationSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: (req.query.organizationSlug as string).toLowerCase() },
      select: { id: true },
    });
    if (org) orgFilterId = org.id;
  }

  try {
    if (orgFilterId !== undefined) {
      const orgMember = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgFilterId, userId } },
      });

      if (orgMember) {
        const orgTeams = await prisma.team.findMany({
          where: { organizationId: orgFilterId },
          include: {
            _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
            createdBy: { select: USER_SELECT_FIELDS },
            members: {
              include: {
                user: { select: USER_SELECT_FIELDS },
                permissions: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        const teams = orgTeams.map((team) => {
          const myMembership = team.members.find((m) => m.userId === userId);
          return {
            ...team,
            myRole: myMembership
              ? myMembership.role
              : orgMember.role === 'OWNER' || orgMember.role === 'ADMIN'
              ? 'ADMIN'
              : 'VIEWER',
            isMember: Boolean(myMembership),
          };
        });

        return res.json({ success: true, data: teams });
      }
    }

    const memberships = await prisma.teamMember.findMany({
      where: {
        userId,
        ...(orgFilterId !== undefined && { team: { organizationId: orgFilterId } }),
      },
      include: {
        team: {
          include: {
            _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
            createdBy: { select: USER_SELECT_FIELDS },
            members: {
              include: {
                user: { select: USER_SELECT_FIELDS },
                permissions: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const teams = memberships.map((m) => ({
      ...m.team,
      myRole: m.role,
      isMember: true,
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

    let finalOrgId: number | null = parsed.data.organizationId || null;
    if (!finalOrgId && parsed.data.organizationSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: parsed.data.organizationSlug.toLowerCase() },
        select: { id: true },
      });
      if (org) finalOrgId = org.id;
    }

    const trimmedName = parsed.data.name.trim();

    // Prevent duplicate team names according to workspace / ownership scope
    const duplicateTeam = await prisma.team.findFirst({
      where: {
        name: trimmedName,
        ...(finalOrgId ? { organizationId: finalOrgId } : { createdById: userId }),
      },
    });
    if (duplicateTeam) {
      return res.status(409).json({
        success: false,
        error: `A team named "${trimmedName}" already exists in this workspace.`,
      });
    }

    // IMPORTANT: Only add the creator as active OWNER. Never auto-add other users without invitations.
    const team = await prisma.team.create({
      data: {
        name: trimmedName,
        description: parsed.data.description?.trim(),
        color: parsed.data.color,
        createdById: userId,
        organizationId: finalOrgId,
        members: {
          create: [{ userId, role: 'OWNER' }],
        },
      },
      include: {
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
        createdBy: { select: USER_SELECT_FIELDS },
      },
    });

    // Automatically create the default "General" group chat conversation for this team
    try {
      await prisma.teamConversation.create({
        data: {
          teamId: team.id,
          type: 'GROUP',
          name: 'General',
        },
      });
    } catch (chatInitErr) {
      console.warn('Failed to initialize team General conversation:', chatInitErr);
    }

    // If other users were selected at creation time, create PENDING invitations for them and send email
    const invitedUserEntries: Array<{ userId: number; role: any }> = [];
    if (parsed.data.members && parsed.data.members.length > 0) {
      for (const m of parsed.data.members) {
        if (m.userId !== userId && !invitedUserEntries.some((x) => x.userId === m.userId)) {
          invitedUserEntries.push({ userId: m.userId, role: m.role || 'DEVELOPER' });
        }
      }
    } else if (parsed.data.memberIds && parsed.data.memberIds.length > 0) {
      for (const mId of parsed.data.memberIds) {
        if (mId !== userId && !invitedUserEntries.some((x) => x.userId === mId)) {
          invitedUserEntries.push({ userId: mId, role: 'DEVELOPER' });
        }
      }
    }

    if (invitedUserEntries.length > 0) {
      const origin = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
      for (const entry of invitedUserEntries) {
        const targetUser = await prisma.user.findUnique({ where: { id: entry.userId } });
        if (targetUser && targetUser.email) {
          const token = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await prisma.teamInvitation.create({
            data: {
              teamId: team.id,
              invitedById: userId,
              invitedEmail: targetUser.email.toLowerCase(),
              assignedRole: entry.role,
              invitationToken: token,
              status: 'PENDING',
              expiresAt,
            },
          });
          const inviteLink = `${origin}/invite/${token}`;
          sendTeamInvitationEmail({
            toEmail: targetUser.email.toLowerCase(),
            teamName: team.name,
            inviterName: user.name || user.email,
            assignedRole: entry.role,
            inviteLink,
          }).catch((err) => console.warn('Background creation invite email error:', err));
        }
      }
    }

    if (finalOrgId) {
      try {
        await prisma.organizationActivity.create({
          data: {
            organizationId: finalOrgId,
            actorId: userId,
            action: 'CREATED_TEAM',
            resourceType: 'TEAM',
            resourceId: team.id,
            details: JSON.stringify({ teamName: team.name, color: team.color }),
          },
        });
      } catch (err) {
        console.error('Failed to record org activity for team creation:', err);
      }
    }

    res.status(201).json({ success: true, data: { ...team, myRole: 'OWNER' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:id — full team detail with members, permissions & invitations
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
        createdBy: { select: USER_SELECT_FIELDS },
        members: {
          include: {
            user: { select: USER_SELECT_FIELDS },
            permissions: true,
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        invitations: {
          where: { status: 'PENDING' },
          include: {
            invitedBy: { select: USER_SELECT_FIELDS },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
      },
    });

    if (!team) return res.status(404).json({ success: false, error: 'Team not found' });

    // Compute active caller permissions for convenient UI consumption
    const callerPermissions = {
      manageTeamMembers: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'manageTeamMembers')),
      removeTeamMembers: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'removeTeamMembers')),
      manageMemberRoles: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'manageMemberRoles')),
      manageTeamDetails: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'manageTeamDetails')),
      manageTeamSettings: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'manageTeamSettings')),
      manageInvitations: membership.role === 'OWNER' || (await hasTeamPermission(teamId, userId, 'manageInvitations')),
    };

    res.json({
      success: true,
      data: {
        ...team,
        myRole: membership.role,
        myPermissions: callerPermissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const updateTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(80, 'Team name cannot exceed 80 characters').optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  color: z.string().optional(),
});

// PATCH /api/teams/:id — update team
teamsRouter.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  const hasPerm = await hasTeamPermission(teamId, userId, 'manageTeamDetails');
  if (!hasPerm) {
    return res.status(403).json({ success: false, error: 'You do not have permission to manage team details' });
  }

  const parsed = updateTeamSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
    const existingTeam = await prisma.team.findUnique({ where: { id: teamId } });
    if (!existingTeam) return res.status(404).json({ success: false, error: 'Team not found' });

    // Validate duplicate team name if changing name
    if (parsed.data.name && parsed.data.name.toLowerCase() !== existingTeam.name.toLowerCase()) {
      const duplicate = await prisma.team.findFirst({
        where: {
          name: parsed.data.name,
          id: { not: teamId },
          ...(existingTeam.organizationId
            ? { organizationId: existingTeam.organizationId }
            : { createdById: existingTeam.createdById }),
        },
      });
      if (duplicate) {
        return res.status(409).json({ success: false, error: `A team named "${parsed.data.name}" already exists.` });
      }
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: parsed.data,
      include: {
        _count: { select: { members: true, invitations: { where: { status: 'PENDING' } } } },
        createdBy: { select: USER_SELECT_FIELDS },
      },
    });

    emitToTeam(teamId, 'team_updated', team);
    res.json({ success: true, data: team });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/teams/:id — delete team (owner only)
teamsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  const membership = await getCallerMembership(teamId, userId);
  if (!membership || membership.role !== 'OWNER') {
    return res.status(403).json({ success: false, error: 'Only the team owner can delete this team' });
  }

  try {
    await prisma.team.delete({
      where: { id: teamId },
    });
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Members ────────────────────────────────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum([
    'ADMIN',
    'DEVELOPER',
    'FRONTEND_DEVELOPER',
    'BACKEND_DEVELOPER',
    'TESTER',
    'DESIGNER',
    'PROJECT_MANAGER',
    'VIEWER',
  ]),
});

// PATCH /api/teams/:id/members/:memberId/role — change member role
teamsRouter.patch('/:id/members/:memberId/role', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const targetUserId = parseId(req.params.memberId);
  if (isNaN(teamId) || isNaN(targetUserId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  const hasPerm = await hasTeamPermission(teamId, callerId, 'manageMemberRoles');
  if (!hasPerm) {
    return res.status(403).json({ success: false, error: 'You do not have permission to change member roles' });
  }

  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership) return res.status(403).json({ success: false, error: 'You are not a member of this team' });

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found in team' });

    // Prevent changing role of the owner
    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'Cannot change the role of the team owner' });
    }

    if (callerMembership.role !== 'OWNER' && !canManage(callerMembership.role, targetMembership.role)) {
      return res.status(403).json({ success: false, error: "Insufficient permissions to change this member's role" });
    }

    const updated = await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role: parsed.data.role },
      include: {
        user: { select: USER_SELECT_FIELDS },
        permissions: true,
      },
    });

    emitToTeam(teamId, 'member_updated', updated);
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
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Not a team member' });

    // Allow self-removal (leaving) OR someone with removeTeamMembers permission
    if (callerId !== targetUserId) {
      const hasPerm = await hasTeamPermission(teamId, callerId, 'removeTeamMembers');
      if (!hasPerm) {
        return res.status(403).json({ success: false, error: 'You do not have permission to remove members' });
      }
    }

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found' });

    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ success: false, error: 'The team owner cannot leave or be removed' });
    }

    if (callerId !== targetUserId && callerMembership.role !== 'OWNER' && !canManage(callerMembership.role, targetMembership.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient hierarchy to remove this member' });
    }

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    emitToTeam(teamId, 'member_removed', { teamId, userId: targetUserId });
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Team Permissions (RBAC) ────────────────────────────────────────────────

// GET /api/teams/:id/permissions — list all member permissions
teamsRouter.get('/:id/permissions', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Not a member of this team' });

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: { select: USER_SELECT_FIELDS },
        permissions: true,
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    const permissionsData = members.map((m) => {
      const isOwner = m.role === 'OWNER';
      const isAdmin = m.role === 'ADMIN';
      const p = Array.isArray(m.permissions) ? m.permissions[0] : (m.permissions as any);

      return {
        memberId: m.userId,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        avatarUrl: m.user.avatarUrl,
        avatarColor: m.user.avatarColor,
        avatarType: m.user.avatarType,
        avatarId: m.user.avatarId,
        permissions: {
          manageTeamMembers: isOwner ? true : p ? p.manageTeamMembers : isAdmin,
          removeTeamMembers: isOwner ? true : p ? p.removeTeamMembers : isAdmin,
          manageMemberRoles: isOwner ? true : p ? p.manageMemberRoles : isAdmin,
          manageTeamDetails: isOwner ? true : p ? p.manageTeamDetails : isAdmin,
          manageTeamSettings: isOwner ? true : p ? p.manageTeamSettings : isAdmin,
          manageInvitations: isOwner ? true : p ? p.manageInvitations : isAdmin,
        },
        isOwner,
        isCustomized: Boolean(p),
      };
    });

    res.json({ success: true, data: permissionsData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const updatePermissionSchema = z.object({
  manageTeamMembers: z.boolean().optional(),
  removeTeamMembers: z.boolean().optional(),
  manageMemberRoles: z.boolean().optional(),
  manageTeamDetails: z.boolean().optional(),
  manageTeamSettings: z.boolean().optional(),
  manageInvitations: z.boolean().optional(),
});

// PATCH /api/teams/:id/members/:memberId/permissions — Owner updates member permissions
teamsRouter.patch('/:id/members/:memberId/permissions', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const targetUserId = parseId(req.params.memberId);
  if (isNaN(teamId) || isNaN(targetUserId)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership || callerMembership.role !== 'OWNER') {
      return res.status(403).json({ success: false, error: 'Only the team owner can configure team permissions' });
    }

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Member not found in team' });

    if (targetMembership.role === 'OWNER') {
      return res.status(400).json({ success: false, error: 'The team owner always retains all permissions and cannot be modified' });
    }

    const parsed = updatePermissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

    const updatedPermission = await prisma.teamMemberPermission.upsert({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      create: {
        teamId,
        userId: targetUserId,
        manageTeamMembers: parsed.data.manageTeamMembers ?? false,
        removeTeamMembers: parsed.data.removeTeamMembers ?? false,
        manageMemberRoles: parsed.data.manageMemberRoles ?? false,
        manageTeamDetails: parsed.data.manageTeamDetails ?? false,
        manageTeamSettings: parsed.data.manageTeamSettings ?? false,
        manageInvitations: parsed.data.manageInvitations ?? false,
        updatedById: callerId,
      },
      update: {
        ...(parsed.data.manageTeamMembers !== undefined && { manageTeamMembers: parsed.data.manageTeamMembers }),
        ...(parsed.data.removeTeamMembers !== undefined && { removeTeamMembers: parsed.data.removeTeamMembers }),
        ...(parsed.data.manageMemberRoles !== undefined && { manageMemberRoles: parsed.data.manageMemberRoles }),
        ...(parsed.data.manageTeamDetails !== undefined && { manageTeamDetails: parsed.data.manageTeamDetails }),
        ...(parsed.data.manageTeamSettings !== undefined && { manageTeamSettings: parsed.data.manageTeamSettings }),
        ...(parsed.data.manageInvitations !== undefined && { manageInvitations: parsed.data.manageInvitations }),
        updatedById: callerId,
      },
    });

    emitToUser(targetUserId, 'permissions_updated', { teamId, permissions: updatedPermission });
    res.json({ success: true, data: updatedPermission });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Invitations ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z
    .enum([
      'ADMIN',
      'DEVELOPER',
      'FRONTEND_DEVELOPER',
      'BACKEND_DEVELOPER',
      'TESTER',
      'DESIGNER',
      'PROJECT_MANAGER',
      'VIEWER',
    ])
    .default('DEVELOPER'),
  message: z.string().max(500).optional(),
});

// POST /api/teams/:id/invite — send invitation
teamsRouter.post('/:id/invite', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  const canInvite =
    (await hasTeamPermission(teamId, callerId, 'manageTeamMembers')) ||
    (await hasTeamPermission(teamId, callerId, 'manageInvitations'));

  if (!canInvite) {
    return res.status(403).json({ success: false, error: 'You do not have permission to invite members' });
  }

  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message });

  try {
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
        invitedBy: { select: USER_SELECT_FIELDS },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    // Send invitation email asynchronously
    const origin = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const inviteLink = `${origin}/invite/${token}`;
    sendTeamInvitationEmail({
      toEmail: email.toLowerCase(),
      teamName: invitation.team.name,
      inviterName: invitation.invitedBy.name,
      assignedRole: role,
      inviteLink,
      message: parsed.data.message,
    }).catch((err) => console.warn('Background sendTeamInvitationEmail error:', err));

    emitToTeam(teamId, 'invitation_created', invitation);

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
    const hasPerm = await hasTeamPermission(teamId, callerId, 'manageInvitations');
    if (!hasPerm) {
      return res.status(403).json({ success: false, error: 'You do not have permission to manage invitations' });
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
        invitedBy: { select: USER_SELECT_FIELDS },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    const origin = req.get('origin') || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const inviteLink = `${origin}/invite/${newToken}`;
    sendTeamInvitationEmail({
      toEmail: updated.invitedEmail,
      teamName: updated.team.name,
      inviterName: updated.invitedBy.name,
      assignedRole: updated.assignedRole,
      inviteLink,
    }).catch((err) => console.warn('Background resend invite email error:', err));

    emitToTeam(teamId, 'invitation_updated', updated);

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
    const hasPerm = await hasTeamPermission(teamId, callerId, 'manageInvitations');
    if (!hasPerm) {
      return res.status(403).json({ success: false, error: 'You do not have permission to cancel invitations' });
    }

    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invId, teamId, status: 'PENDING' } });
    if (!invitation) return res.status(404).json({ success: false, error: 'Pending invitation not found' });

    await prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: { status: 'CANCELLED' },
    });

    emitToTeam(teamId, 'invitation_cancelled', { id: invId, teamId });

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
        invitedBy: { select: USER_SELECT_FIELDS },
      },
    });

    if (!invitation) return res.status(404).json({ success: false, error: 'Invalid invitation link' });

    if (invitation.status !== 'PENDING') {
      return res.status(410).json({
        success: false,
        error: `This invitation has already been ${invitation.status.toLowerCase()}`,
        status: invitation.status,
      });
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
      include: {
        team: true,
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invitation) return res.status(404).json({ success: false, error: 'Invalid invitation' });
    if (invitation.status !== 'PENDING') {
      return res.status(410).json({ success: false, error: `Invitation is ${invitation.status.toLowerCase()}` });
    }
    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
      return res.status(410).json({ success: false, error: 'Invitation has expired' });
    }

    // Verify email matches authenticated user
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
      await prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      return res.json({ success: true, message: 'You are already a member of this team', teamId: invitation.teamId });
    }

    // Add to team and mark accepted transactionally
    const [newMember] = await prisma.$transaction([
      prisma.teamMember.create({
        data: { teamId: invitation.teamId, userId, role: invitation.assignedRole },
        include: { user: { select: USER_SELECT_FIELDS } },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);

    // Send notification email to the inviter
    if (invitation.invitedBy?.email) {
      sendInvitationDecisionEmail({
        toEmail: invitation.invitedBy.email,
        userName: user.name || user.email,
        teamName: invitation.team.name,
        decision: 'ACCEPTED',
        role: invitation.assignedRole,
      }).catch((err) => console.warn('Background sendInvitationDecisionEmail error:', err));
    }

    emitToTeam(invitation.teamId, 'member_joined', newMember);

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
    const invitation = await prisma.teamInvitation.findUnique({
      where: { invitationToken: token },
      include: {
        team: true,
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      return res.status(404).json({ success: false, error: 'Invitation not found or already processed' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Email mismatch' });
    }

    await prisma.teamInvitation.update({ where: { id: invitation.id }, data: { status: 'DECLINED' } });

    if (invitation.invitedBy?.email) {
      sendInvitationDecisionEmail({
        toEmail: invitation.invitedBy.email,
        userName: user.name || user.email,
        teamName: invitation.team.name,
        decision: 'DECLINED',
      }).catch((err) => console.warn('Background sendInvitationDecisionEmail error:', err));
    }

    emitToTeam(invitation.teamId, 'invitation_declined', { id: invitation.id, teamId: invitation.teamId });

    res.json({ success: true, message: 'Invitation declined' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Team Chat & Mentions Endpoints ──────────────────────────────────────────

// GET /api/teams/:id/conversations — list team conversations (Group + Direct)
teamsRouter.get('/:id/conversations', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid team ID' });

  try {
    const membership = await getCallerMembership(teamId, callerId);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this team' });

    // Ensure general channel exists
    let generalChannel = await prisma.teamConversation.findFirst({
      where: { teamId, type: 'GROUP', name: 'General' },
    });
    if (!generalChannel) {
      generalChannel = await prisma.teamConversation.create({
        data: { teamId, type: 'GROUP', name: 'General' },
      });
    }

    // Fetch all conversations for this team
    const allConversations = await prisma.teamConversation.findMany({
      where: { teamId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: USER_SELECT_FIELDS } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter conversations: GROUP is visible to all; DIRECT is visible only if callerId in participantIds
    const filtered = allConversations.filter((c) => {
      if (c.type === 'GROUP') return true;
      if (!c.participantIds) return false;
      try {
        const pIds: number[] = JSON.parse(c.participantIds);
        return pIds.includes(callerId);
      } catch {
        return false;
      }
    });

    // Calculate unread counts and resolve participant details for DIRECT chats
    const formatted = await Promise.all(
      filtered.map(async (c) => {
        let otherUser = null;
        if (c.type === 'DIRECT' && c.participantIds) {
          try {
            const pIds: number[] = JSON.parse(c.participantIds);
            const otherId = pIds.find((id) => id !== callerId);
            if (otherId) {
              otherUser = await prisma.user.findUnique({
                where: { id: otherId },
                select: USER_SELECT_FIELDS,
              });
            }
          } catch {
            // ignore
          }
        }

        // Count unread messages (where callerId is not in readBy)
        const unreadCount = await prisma.teamMessage.count({
          where: {
            conversationId: c.id,
            senderId: { not: callerId },
            OR: [
              { readBy: null },
              { NOT: { readBy: { contains: `"${callerId}"` } } },
            ],
          },
        });

        return {
          id: c.id,
          teamId: c.teamId,
          type: c.type,
          name: c.name || (otherUser ? otherUser.name : 'Direct Message'),
          participantIds: c.participantIds,
          otherUser,
          lastMessage: c.messages[0] || null,
          unreadCount,
          updatedAt: c.updatedAt,
        };
      })
    );

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:id/conversations/direct — create or get 1-on-1 direct conversation
teamsRouter.post('/:id/conversations/direct', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const targetUserId = parseId(req.body.targetUserId);
  if (isNaN(teamId) || isNaN(targetUserId)) {
    return res.status(400).json({ success: false, error: 'Invalid parameters' });
  }

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Not a member of this team' });

    const targetMembership = await getCallerMembership(teamId, targetUserId);
    if (!targetMembership) return res.status(404).json({ success: false, error: 'Target user is not a team member' });

    const sortedIds = [callerId, targetUserId].sort((a, b) => a - b);
    const participantIdsStr = JSON.stringify(sortedIds);

    let conversation = await prisma.teamConversation.findFirst({
      where: {
        teamId,
        type: 'DIRECT',
        participantIds: participantIdsStr,
      },
    });

    if (!conversation) {
      conversation = await prisma.teamConversation.create({
        data: {
          teamId,
          type: 'DIRECT',
          participantIds: participantIdsStr,
        },
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: USER_SELECT_FIELDS,
    });

    res.json({
      success: true,
      data: {
        ...conversation,
        name: targetUser?.name || 'Direct Message',
        otherUser: targetUser,
        unreadCount: 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/teams/:id/conversations/:convId/messages — fetch message history
teamsRouter.get('/:id/conversations/:convId/messages', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const convId = parseId(req.params.convId);
  if (isNaN(teamId) || isNaN(convId)) return res.status(400).json({ success: false, error: 'Invalid parameters' });

  try {
    const membership = await getCallerMembership(teamId, callerId);
    if (!membership) return res.status(403).json({ success: false, error: 'Not a member of this team' });

    const conversation = await prisma.teamConversation.findFirst({
      where: { id: convId, teamId },
    });
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const messages = await prisma.teamMessage.findMany({
      where: { conversationId: convId },
      include: {
        sender: { select: USER_SELECT_FIELDS },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: messages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:id/conversations/:convId/messages — send new message with @mentions
teamsRouter.post('/:id/conversations/:convId/messages', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const convId = parseId(req.params.convId);
  if (isNaN(teamId) || isNaN(convId)) return res.status(400).json({ success: false, error: 'Invalid parameters' });

  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ success: false, error: 'Message content cannot be empty' });

  try {
    const callerMembership = await getCallerMembership(teamId, callerId);
    if (!callerMembership) return res.status(403).json({ success: false, error: 'Not a member of this team' });

    const conversation = await prisma.teamConversation.findFirst({
      where: { id: convId, teamId },
    });
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    // Validate/Parse mentions: array of user IDs
    let mentionUserIds: number[] = [];
    if (Array.isArray(req.body.mentions)) {
      mentionUserIds = req.body.mentions.map((id: any) => Number(id)).filter((id: number) => !isNaN(id));
    } else {
      // Auto-extract @mentions by username or name from team members
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId },
        include: { user: { select: { id: true, username: true, name: true } } },
      });
      teamMembers.forEach((tm) => {
        if (
          (tm.user.username && content.toLowerCase().includes(`@${tm.user.username.toLowerCase()}`)) ||
          (tm.user.name && content.toLowerCase().includes(`@${tm.user.name.toLowerCase()}`))
        ) {
          if (!mentionUserIds.includes(tm.user.id) && tm.user.id !== callerId) {
            mentionUserIds.push(tm.user.id);
          }
        }
      });
    }

    const message = await prisma.teamMessage.create({
      data: {
        teamId,
        conversationId: convId,
        senderId: callerId,
        content,
        mentions: mentionUserIds.length > 0 ? JSON.stringify(mentionUserIds) : null,
        readBy: JSON.stringify([callerId]),
      },
      include: {
        sender: { select: USER_SELECT_FIELDS },
      },
    });

    // Touch conversation updatedAt
    await prisma.teamConversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    });

    // Real-time broadcast to team
    emitToTeam(teamId, 'new_message', {
      conversationId: convId,
      message,
    });

    // Dispatch direct mention notifications
    if (mentionUserIds.length > 0) {
      for (const mentionedId of mentionUserIds) {
        emitToUser(mentionedId, 'mention_notification', {
          teamId,
          conversationId: convId,
          messageId: message.id,
          senderName: message.sender.name,
          content: message.content,
        });
      }
    }

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/teams/:id/conversations/:convId/read — mark conversation messages as read
teamsRouter.post('/:id/conversations/:convId/read', async (req: Request, res: Response) => {
  const callerId = getUserIdFromToken(req);
  if (!callerId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const teamId = parseId(req.params.id);
  const convId = parseId(req.params.convId);
  if (isNaN(teamId) || isNaN(convId)) return res.status(400).json({ success: false, error: 'Invalid parameters' });

  try {
    const unreadMessages = await prisma.teamMessage.findMany({
      where: {
        conversationId: convId,
        senderId: { not: callerId },
        OR: [
          { readBy: null },
          { NOT: { readBy: { contains: `"${callerId}"` } } },
        ],
      },
      select: { id: true, readBy: true },
    });

    for (const msg of unreadMessages) {
      let readList: number[] = [];
      try {
        if (msg.readBy) readList = JSON.parse(msg.readBy);
      } catch {
        readList = [];
      }
      if (!readList.includes(callerId)) {
        readList.push(callerId);
        await prisma.teamMessage.update({
          where: { id: msg.id },
          data: { readBy: JSON.stringify(readList) },
        });
      }
    }

    res.json({ success: true, markedCount: unreadMessages.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
