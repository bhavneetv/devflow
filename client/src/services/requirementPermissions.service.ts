/**
 * DevFlow Requirements Management — Client-Side Permissions Service (Phase 2)
 *
 * Reuses the exact same governance & RBAC matrix as backend.
 * Provides typed access checks and Access Denied UI state helpers.
 */

export type RequirementAction =
  | 'view'
  | 'create'
  | 'edit_own_draft'
  | 'edit_approved'
  | 'submit_for_review'
  | 'review'
  | 'approve'
  | 'reject'
  | 'create_linked_task'
  | 'manage_categories'
  | 'archive';

export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'REVIEWER'
  | 'DEVELOPER'
  | 'VIEWER';

export interface UserContext {
  id: number;
  email?: string;
  name?: string;
  orgRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  projectRole?: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | null;
  isProjectOwner?: boolean;
  teamRole?: string | null;
  permissions?: {
    canCreateRequirements?: boolean;
    canSubmitRequirements?: boolean;
    canEditDrafts?: boolean;
    canLinkTasks?: boolean;
    canReview?: boolean;
  };
}

export interface RequirementResource {
  id?: number;
  code?: string;
  projectId: number;
  organizationId?: number | null;
  authorId: number;
  reviewerId?: number | null;
  responsibleMemberId?: number | null;
  responsibleTeamId?: number | null;
  workflowStatus:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'CHANGES_REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'DEPRECATED'
    | 'ARCHIVED';
  implementationStatus?:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'BLOCKED'
    | 'IMPLEMENTED'
    | 'VERIFIED';
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  code?:
    | 'UNAUTHENTICATED'
    | 'NOT_ORG_MEMBER'
    | 'ORG_RESTRICTED'
    | 'NOT_PROJECT_MEMBER'
    | 'ROLE_INSUFFICIENT'
    | 'AUTHOR_CANNOT_APPROVE'
    | 'APPROVED_REQUIREMENT_LOCKED'
    | 'NOT_DESIGNATED_REVIEWER'
    | 'INVALID_STATUS_TRANSITION';
}

export function resolveEffectiveRole(
  user: UserContext,
  resource?: Partial<RequirementResource>
): UserRole {
  if (user.orgRole === 'OWNER' || user.isProjectOwner || user.projectRole === 'OWNER') {
    return 'OWNER';
  }
  if (user.orgRole === 'ADMIN' || user.projectRole === 'MANAGER') {
    return 'MANAGER';
  }
  if (resource && resource.reviewerId === user.id) {
    return 'REVIEWER';
  }
  if (user.orgRole === 'VIEWER' || user.projectRole === 'VIEWER') {
    return 'VIEWER';
  }
  if (user.teamRole === 'TESTER' || user.teamRole === 'PROJECT_MANAGER') {
    return 'MANAGER';
  }
  return 'DEVELOPER';
}

export function can(
  user: UserContext | null | undefined,
  action: RequirementAction,
  resource?: Partial<RequirementResource>
): AccessResult {
  if (!user || !user.id) {
    return {
      allowed: false,
      code: 'UNAUTHENTICATED',
      reason: 'Please sign in to perform this action.',
    };
  }

  if (user.orgRole === null || user.orgRole === undefined) {
    return {
      allowed: false,
      code: 'NOT_ORG_MEMBER',
      reason: 'You are not a member of this organization.',
    };
  }

  if (action === 'manage_categories') {
    if (user.orgRole === 'OWNER' || user.orgRole === 'ADMIN') {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'ROLE_INSUFFICIENT',
      reason: 'Only Organization Admins or Owners can manage categories.',
    };
  }

  // Hard Governance Rule: Author CANNOT approve own requirement
  const isAuthor = Boolean(resource && resource.authorId === user.id);
  if ((action === 'approve' || action === 'reject') && isAuthor) {
    return {
      allowed: false,
      code: 'AUTHOR_CANNOT_APPROVE',
      reason: 'Governance Rule: You cannot approve or reject a requirement you authored.',
    };
  }

  if (action === 'edit_approved') {
    if (resource && resource.workflowStatus !== 'APPROVED') {
      return {
        allowed: false,
        code: 'INVALID_STATUS_TRANSITION',
        reason: 'Requirement is not approved.',
      };
    }
    // Audit Decision (Item 11 / Spec §17 Permission Matrix):
    // Per the original specification §17 permission matrix, both Project Owners AND Managers
    // are authorized to edit approved requirements (initiating a new revision and branching to PENDING_REVIEW).
    // The inclusion of MANAGER here is intentional and correct by design.
    if (user.orgRole === 'OWNER' || user.orgRole === 'ADMIN' || user.isProjectOwner || user.projectRole === 'OWNER' || user.projectRole === 'MANAGER') {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'APPROVED_REQUIREMENT_LOCKED',
      reason: 'Approved requirements can only be revised by Project Owners or Managers.',
    };
  }

  const effectiveRole = resolveEffectiveRole(user, resource);

  if (effectiveRole === 'VIEWER') {
    if (action === 'view') {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'ROLE_INSUFFICIENT',
      reason: 'Viewers have read-only access to requirements.',
    };
  }

  switch (action) {
    case 'view':
      return { allowed: true };

    case 'create': {
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (user.permissions?.canCreateRequirements === false) {
        return {
          allowed: false,
          code: 'ROLE_INSUFFICIENT',
          reason: 'Creation of requirements is restricted for your role.',
        };
      }
      return { allowed: true };
    }

    case 'edit_own_draft': {
      if (resource && resource.workflowStatus && resource.workflowStatus !== 'DRAFT' && resource.workflowStatus !== 'CHANGES_REQUESTED') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement can only be edited when in Draft or Changes Requested status.',
        };
      }
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || isAuthor) {
        return { allowed: true };
      }
      if (user.permissions?.canEditDrafts === true) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'Only the author or a manager can edit this draft.',
      };
    }

    case 'submit_for_review': {
      if (resource && resource.workflowStatus && resource.workflowStatus !== 'DRAFT' && resource.workflowStatus !== 'CHANGES_REQUESTED') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Only Draft requirements can be submitted for review.',
        };
      }
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (isAuthor) {
        return { allowed: true };
      }
      if (effectiveRole === 'DEVELOPER') {
        if (user.permissions?.canSubmitRequirements === true) {
          return { allowed: true };
        }
        return {
          allowed: false,
          code: 'ROLE_INSUFFICIENT',
          reason: 'Developers can propose drafts, but submitting for formal review requires Manager or Author authorization.',
        };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'You do not have permission to submit this requirement.',
      };
    }

    case 'review': {
      if (resource && resource.workflowStatus !== 'PENDING_REVIEW') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement is not currently pending review.',
        };
      }
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (resource && resource.reviewerId === user.id) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'NOT_DESIGNATED_REVIEWER',
        reason: 'Only the designated reviewer or project managers can review this requirement.',
      };
    }

    case 'approve':
    case 'reject': {
      if (resource && resource.workflowStatus !== 'PENDING_REVIEW') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement must be in Pending Review to approve or reject.',
        };
      }
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (resource && resource.reviewerId === user.id) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'Only designated reviewers or managers can approve/reject requirements.',
      };
    }

    case 'create_linked_task': {
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || effectiveRole === 'DEVELOPER') {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'You do not have permission to link tasks.',
      };
    }

    case 'archive': {
      if (effectiveRole === 'OWNER' || (effectiveRole === 'MANAGER' && user.isProjectOwner)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'Only Project Owners and Managers can archive requirements.',
      };
    }

    default:
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'Action not permitted.',
      };
  }
}
