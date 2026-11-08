import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getUserIdFromToken } from '../lib/auth.js';
import { emitToUser, emitToTeam } from '../lib/socket.js';
import { sendInvitationDecisionEmail } from '../lib/email.service.js';

export const notificationsRouter = Router();

export interface CreateNotificationParams {
  recipientId: number;
  type: 'ORGANIZATION_INVITATION' | 'TEAM_INVITATION' | 'SYSTEM';
  title: string;
  message: string;
  data?: Record<string, any>;
  relatedInvitationId?: number;
  relatedOrganizationId?: number;
  relatedTeamId?: number;
}

/**
 * Creates an in-app notification in the database and broadcasts in real-time via Socket.IO
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ? JSON.stringify(params.data) : null,
        relatedInvitationId: params.relatedInvitationId || null,
        relatedOrganizationId: params.relatedOrganizationId || null,
        relatedTeamId: params.relatedTeamId || null,
      },
    });

    // Real-time delivery to user's personal socket room
    emitToUser(params.recipientId, 'new_notification', notification);
    return notification;
  } catch (err: any) {
    console.error('Failed to create in-app notification:', err.message);
    return null;
  }
}

// GET /api/notifications — list caller's notifications
notificationsRouter.get('/', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const parsed = notifications.map((n) => {
      let parsedData: any = null;
      if (n.data) {
        try {
          parsedData = JSON.parse(n.data);
        } catch {
          parsedData = null;
        }
      }
      return {
        ...n,
        parsedData,
      };
    });

    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count — get count of unread notifications
notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const count = await prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/:id/read — mark single notification as read
notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, recipientId: userId },
    });
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/notifications/read-all — mark all notifications as read
notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/:id/action — Accept or decline an invitation directly from the notification
notificationsRouter.post('/:id/action', async (req: Request, res: Response) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const id = parseInt(String(req.params.id), 10);
  const action = req.body.action as 'ACCEPT' | 'DECLINE';
  if (isNaN(id) || !['ACCEPT', 'DECLINE'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Invalid parameters' });
  }

  try {
    const notification = await prisma.notification.findFirst({
      where: { id, recipientId: userId },
    });
    if (!notification) return res.status(404).json({ success: false, error: 'Notification not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    let meta: any = {};
    if (notification.data) {
      try {
        meta = JSON.parse(notification.data);
      } catch {
        // ignore
      }
    }

    if (notification.type === 'ORGANIZATION_INVITATION') {
      const invitationId = notification.relatedInvitationId || meta.invitationId;
      const token = meta.token;

      const invitation = await prisma.organizationInvitation.findFirst({
        where: invitationId ? { id: invitationId } : { invitationToken: token },
        include: { organization: true, invitedBy: true },
      });

      if (!invitation) {
        return res.status(404).json({ success: false, error: 'Organization invitation not found' });
      }

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ success: false, error: `Invitation already ${invitation.status.toLowerCase()}` });
      }

      if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Email mismatch' });
      }

      if (action === 'ACCEPT') {
        await prisma.$transaction([
          prisma.organizationMember.upsert({
            where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
            update: { role: invitation.assignedRole },
            create: {
              organizationId: invitation.organizationId,
              userId,
              role: invitation.assignedRole,
            },
          }),
          prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
          }),
          prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true },
          }),
        ]);

        sendInvitationDecisionEmail({
          toEmail: invitation.invitedBy.email,
          userName: user.name || user.email,
          targetName: invitation.organization.name,
          type: 'ORGANIZATION',
          decision: 'ACCEPTED',
          role: invitation.assignedRole,
        }).catch((e) => console.warn('Background email error:', e));

        return res.json({
          success: true,
          message: `You have successfully joined ${invitation.organization.name}`,
          organization: invitation.organization,
        });
      } else {
        await prisma.$transaction([
          prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: 'DECLINED' },
          }),
          prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true },
          }),
        ]);

        sendInvitationDecisionEmail({
          toEmail: invitation.invitedBy.email,
          userName: user.name || user.email,
          targetName: invitation.organization.name,
          type: 'ORGANIZATION',
          decision: 'DECLINED',
        }).catch((e) => console.warn('Background email error:', e));

        return res.json({ success: true, message: 'Invitation declined' });
      }
    } else if (notification.type === 'TEAM_INVITATION') {
      const invitationId = notification.relatedInvitationId || meta.invitationId;
      const token = meta.token;

      const invitation = await prisma.teamInvitation.findFirst({
        where: invitationId ? { id: invitationId } : { invitationToken: token },
        include: { team: true, invitedBy: true },
      });

      if (!invitation) {
        return res.status(404).json({ success: false, error: 'Team invitation not found' });
      }

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ success: false, error: `Invitation already ${invitation.status.toLowerCase()}` });
      }

      if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Email mismatch' });
      }

      if (action === 'ACCEPT') {
        const txOps: any[] = [
          prisma.teamMember.upsert({
            where: { teamId_userId: { teamId: invitation.teamId, userId } },
            update: { role: invitation.assignedRole },
            create: { teamId: invitation.teamId, userId, role: invitation.assignedRole },
          }),
          prisma.teamInvitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED', acceptedAt: new Date() },
          }),
          prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true },
          }),
        ];

        // If team belongs to organization, ensure user is also an organization member
        if (invitation.team.organizationId) {
          txOps.push(
            prisma.organizationMember.upsert({
              where: {
                organizationId_userId: {
                  organizationId: invitation.team.organizationId,
                  userId,
                },
              },
              update: {},
              create: {
                organizationId: invitation.team.organizationId,
                userId,
                role: 'MEMBER',
              },
            })
          );
        }

        await prisma.$transaction(txOps);

        sendInvitationDecisionEmail({
          toEmail: invitation.invitedBy.email,
          userName: user.name || user.email,
          targetName: invitation.team.name,
          type: 'TEAM',
          decision: 'ACCEPTED',
          role: invitation.assignedRole,
        }).catch((e) => console.warn('Background email error:', e));

        emitToTeam(invitation.teamId, 'member_joined', { teamId: invitation.teamId, userId });

        return res.json({
          success: true,
          message: `You have successfully joined ${invitation.team.name}`,
          team: invitation.team,
        });
      } else {
        await prisma.$transaction([
          prisma.teamInvitation.update({
            where: { id: invitation.id },
            data: { status: 'DECLINED' },
          }),
          prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true },
          }),
        ]);

        sendInvitationDecisionEmail({
          toEmail: invitation.invitedBy.email,
          userName: user.name || user.email,
          targetName: invitation.team.name,
          type: 'TEAM',
          decision: 'DECLINED',
        }).catch((e) => console.warn('Background email error:', e));

        return res.json({ success: true, message: 'Invitation declined' });
      }
    }

    return res.status(400).json({ success: false, error: 'Unsupported notification type for this action' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Action failed' });
  }
});

/**
 * Synchronizes any pending organization or team invitations for a user when they log in or register.
 */
export async function syncPendingInvitationsForUser(userId: number, email: string) {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check pending Org invitations
    const pendingOrgInvites = await prisma.organizationInvitation.findMany({
      where: {
        invitedEmail: normalizedEmail,
        status: 'PENDING',
      },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    for (const inv of pendingOrgInvites) {
      const existingNotif = await prisma.notification.findFirst({
        where: {
          recipientId: userId,
          type: 'ORGANIZATION_INVITATION',
          relatedInvitationId: inv.id,
        },
      });

      if (!existingNotif) {
        await createNotification({
          recipientId: userId,
          type: 'ORGANIZATION_INVITATION',
          title: `Invited to join ${inv.organization.name}`,
          message: `${inv.invitedBy.name || inv.invitedBy.email} invited you to join ${inv.organization.name} as a ${inv.assignedRole}.`,
          relatedInvitationId: inv.id,
          relatedOrganizationId: inv.organizationId,
          data: {
            invitationToken: inv.invitationToken,
            organizationName: inv.organization.name,
            role: inv.assignedRole,
            inviterName: inv.invitedBy.name || inv.invitedBy.email,
          },
        });
      }
    }

    // 2. Check pending Team invitations
    const pendingTeamInvites = await prisma.teamInvitation.findMany({
      where: {
        invitedEmail: normalizedEmail,
        status: 'PENDING',
      },
      include: {
        team: { select: { id: true, name: true, organizationId: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });

    for (const inv of pendingTeamInvites) {
      const existingNotif = await prisma.notification.findFirst({
        where: {
          recipientId: userId,
          type: 'TEAM_INVITATION',
          relatedInvitationId: inv.id,
        },
      });

      if (!existingNotif) {
        await createNotification({
          recipientId: userId,
          type: 'TEAM_INVITATION',
          title: `Invited to join team ${inv.team.name}`,
          message: `${inv.invitedBy.name || inv.invitedBy.email} invited you to join team ${inv.team.name} as ${inv.assignedRole}.`,
          relatedInvitationId: inv.id,
          relatedTeamId: inv.teamId,
          relatedOrganizationId: inv.team.organizationId || undefined,
          data: {
            invitationToken: inv.invitationToken,
            teamName: inv.team.name,
            role: inv.assignedRole,
            inviterName: inv.invitedBy.name || inv.invitedBy.email,
          },
        });
      }
    }
  } catch (err: any) {
    console.error('Failed to sync pending invitations for user:', err.message);
  }
}

