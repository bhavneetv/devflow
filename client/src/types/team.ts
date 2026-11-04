// Team Management Types

export type TeamMemberRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'FRONTEND_DEVELOPER'
  | 'BACKEND_DEVELOPER'
  | 'TESTER'
  | 'DESIGNER'
  | 'PROJECT_MANAGER'
  | 'VIEWER';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface TeamUser {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  user: TeamUser;
  role: TeamMemberRole;
  joinedAt: string;
}

export interface TeamInvitation {
  id: number;
  teamId: number;
  invitedById: number;
  invitedBy: TeamUser;
  invitedEmail: string;
  assignedRole: TeamMemberRole;
  invitationToken: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
}

export interface Team {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  createdById: number;
  createdBy: TeamUser;
  members: TeamMember[];
  invitations: TeamInvitation[];
  _count: {
    members: number;
    invitations: number;
  };
  myRole: TeamMemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface TeamSummary {
  id: number;
  name: string;
  description?: string | null;
  color: string;
  createdById: number;
  createdBy: TeamUser;
  _count: {
    members: number;
    invitations: number;
  };
  myRole: TeamMemberRole;
  createdAt: string;
  updatedAt: string;
}

export interface InvitationPreview {
  id: number;
  invitedEmail: string;
  assignedRole: TeamMemberRole;
  expiresAt: string;
  team: { id: number; name: string; description?: string | null; color: string };
  invitedBy: TeamUser;
}

// Role display metadata
export const ROLE_LABELS: Record<TeamMemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  FRONTEND_DEVELOPER: 'Frontend Developer',
  BACKEND_DEVELOPER: 'Backend Developer',
  TESTER: 'QA Engineer',
  DESIGNER: 'UI/UX Designer',
  PROJECT_MANAGER: 'Project Manager',
  VIEWER: 'Viewer',
};

export const ROLE_COLORS: Record<TeamMemberRole, { bg: string; text: string; border: string }> = {
  OWNER: { bg: '#7C3AED20', text: '#A78BFA', border: '#7C3AED40' },
  ADMIN: { bg: '#2563EB20', text: '#60A5FA', border: '#2563EB40' },
  DEVELOPER: { bg: '#05966920', text: '#34D399', border: '#05966940' },
  FRONTEND_DEVELOPER: { bg: '#0891B220', text: '#22D3EE', border: '#0891B240' },
  BACKEND_DEVELOPER: { bg: '#D9770620', text: '#FB923C', border: '#D9770640' },
  TESTER: { bg: '#B4530520', text: '#F97316', border: '#B4530540' },
  DESIGNER: { bg: '#BE185D20', text: '#F472B6', border: '#BE185D40' },
  PROJECT_MANAGER: { bg: '#1D4ED820', text: '#93C5FD', border: '#1D4ED840' },
  VIEWER: { bg: '#52525B20', text: '#A1A1AA', border: '#52525B40' },
};

export const ASSIGNABLE_ROLES: TeamMemberRole[] = [
  'ADMIN',
  'DEVELOPER',
  'FRONTEND_DEVELOPER',
  'BACKEND_DEVELOPER',
  'TESTER',
  'DESIGNER',
  'PROJECT_MANAGER',
  'VIEWER',
];

