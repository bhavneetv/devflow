export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  currentUserRole?: OrganizationRole;
  joinedAt?: string;
  isOwner?: boolean;
  _count?: {
    members: number;
    teams: number;
    projects: number;
    invitations?: number;
  };
}

export interface OrganizationMember {
  id: number;
  userId: number;
  role: OrganizationRole;
  joinedAt: string;
  isSelf?: boolean;
  canManage?: boolean;
  user: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
    avatarColor?: string | null;
    avatarId?: string | null;
    avatarType?: string | null;
    role?: string;
  };
}

export interface OrganizationInvitation {
  id: number;
  organizationId: number;
  invitedById: number;
  invitedEmail: string;
  assignedRole: OrganizationRole;
  invitationToken: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string | null;
  invitedBy?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface OrganizationActivity {
  id: number;
  organizationId: number;
  actorId: number | null;
  action: string;
  resourceType: string;
  resourceId: number | null;
  details: string | null;
  createdAt: string;
  actor?: {
    id: number;
    name: string;
    email: string;
    avatarUrl: string | null;
    avatarColor?: string | null;
  } | null;
}

export interface OrganizationOverviewData {
  organization: Organization;
  currentRole?: OrganizationRole;
  stats: {
    totalMembers: number;
    totalTeams: number;
    totalProjects: number;
    openIssues: number;
    completedIssues?: number;
    totalTasks?: number;
  };
  summary?: {
    totalMembers: number;
    totalTeams: number;
    totalProjects: number;
    openIssues: number;
    completedIssues?: number;
    totalTasks?: number;
  };
  teams: any[];
  projects: any[];
  recentActivity: OrganizationActivity[];
  recentActivities?: OrganizationActivity[];
  members?: any[];
  allTasks?: any[];
  projectStatusCounts?: {
    IN_PROGRESS: number;
    COMPLETED: number;
    PLANNING: number;
    ARCHIVED: number;
  };
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  initialInvites?: { email: string; role: OrganizationRole }[];
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
}
