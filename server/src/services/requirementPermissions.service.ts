/**
 * DevFlow Requirements Management — Permissions & Governance Service (Phase 2)
 *
 * Implements: can(user, action, resource)
 * Enforces evaluation chain:
 *   Org Restrictions → Project Membership → Team Scope → Role Matrix → Governance Overrides
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
  // Org level
  orgRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  // Project level
  projectRole?: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER' | null;
  isProjectOwner?: boolean;
  // Team level
  teamRole?: string | null;
  // Explicit permission overrides / flags
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

/**
 * Resolves the effective requirement role of a user for a given project/requirement.
 */
export function resolveEffectiveRole(
  user: UserContext,
  resource?: Partial<RequirementResource>
): UserRole {
  // Org Owner or Project Owner has OWNER privileges
  if (user.orgRole === 'OWNER' || user.isProjectOwner || user.projectRole === 'OWNER') {
    return 'OWNER';
  }

  // Org Admin or Project Manager has MANAGER privileges
  if (user.orgRole === 'ADMIN' || user.projectRole === 'MANAGER') {
    return 'MANAGER';
  }

  // If user is the designated reviewer on this requirement
  if (resource && resource.reviewerId === user.id) {
    return 'REVIEWER';
  }

  // Org / Project Viewer
  if (user.orgRole === 'VIEWER' || user.projectRole === 'VIEWER') {
    return 'VIEWER';
  }

  // Default team/member roles
  if (user.teamRole === 'TESTER' || user.teamRole === 'PROJECT_MANAGER') {
    return 'MANAGER';
  }

  return 'DEVELOPER';
}

/**
 * Core Permission Function: can(user, action, resource)
 * Evaluates the 4-tier chain:
 * 1. Org restrictions
 * 2. Project membership
 * 3. Governance hard rules (e.g. Author CANNOT approve own requirement)
 * 4. Role matrix & configurable toggles
 */
export function can(
  user: UserContext | null | undefined,
  action: RequirementAction,
  resource?: Partial<RequirementResource>
): AccessResult {
  // Tier 0: Authenticated user check
  if (!user || !user.id) {
    return {
      allowed: false,
      code: 'UNAUTHENTICATED',
      reason: 'User must be authenticated to perform this action.',
    };
  }

  // Tier 1: Organization restrictions
  if (user.orgRole === null || user.orgRole === undefined) {
    return {
      allowed: false,
      code: 'NOT_ORG_MEMBER',
      reason: 'User is not a member of the organization.',
    };
  }

  // Tier 2: Category management (Org Admin / Owner only)
  if (action === 'manage_categories') {
    if (user.orgRole === 'OWNER' || user.orgRole === 'ADMIN') {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: 'ROLE_INSUFFICIENT',
      reason: 'Only Organization Owners and Admins can manage requirement categories.',
    };
  }

  // Tier 3: Governance Overrides (Rule 4: Author CANNOT approve own requirement)
  const isAuthor = Boolean(resource && resource.authorId === user.id);

  if ((action === 'approve' || action === 'reject') && isAuthor) {
    return {
      allowed: false,
      code: 'AUTHOR_CANNOT_APPROVE',
      reason: 'Governance Rule Violation: The author of a requirement cannot approve or reject their own requirement.',
    };
  }

  // Rule 5 Governance: Editing approved requirement
  if (action === 'edit_approved') {
    if (resource && resource.workflowStatus !== 'APPROVED') {
      return {
        allowed: false,
        code: 'INVALID_STATUS_TRANSITION',
        reason: 'Requirement is not in APPROVED status.',
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
      reason: 'Only Project Owners or Managers can edit an approved requirement.',
    };
  }

  const effectiveRole = resolveEffectiveRole(user, resource);

  // Viewer restriction
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

  // Action-specific matrix resolution
  switch (action) {
    case 'view':
      return { allowed: true };

    case 'create': {
      // Owner, Manager, Author: Yes
      // Reviewer, Dev: Configurable (default: Dev allowed if canCreateRequirements !== false)
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (user.permissions?.canCreateRequirements === false) {
        return {
          allowed: false,
          code: 'ROLE_INSUFFICIENT',
          reason: 'Your account is not configured to create requirements.',
        };
      }
      // Developer and Reviewer can create (propose) by default
      return { allowed: true };
    }

    case 'edit_own_draft': {
      // Drafts can only be edited in DRAFT or CHANGES_REQUESTED
      if (resource && resource.workflowStatus && resource.workflowStatus !== 'DRAFT' && resource.workflowStatus !== 'CHANGES_REQUESTED') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement draft can only be edited when in DRAFT or CHANGES_REQUESTED status.',
        };
      }
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      if (isAuthor) {
        return { allowed: true };
      }
      if (effectiveRole === 'REVIEWER') {
        return { allowed: true };
      }
      if (user.permissions?.canEditDrafts === true) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'Only the author or managers can edit this draft requirement.',
      };
    }

    case 'submit_for_review': {
      if (resource && resource.workflowStatus && resource.workflowStatus !== 'DRAFT' && resource.workflowStatus !== 'CHANGES_REQUESTED') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Only requirements in DRAFT or CHANGES_REQUESTED status can be submitted for review.',
        };
      }
      // Owner and Manager can submit
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER') {
        return { allowed: true };
      }
      // Author CAN submit their own draft requirement (per matrix)
      if (isAuthor) {
        return { allowed: true };
      }
      // Developer matrix rule & checkpoint: Developer can propose (create) but cannot submit unless explicitly permitted
      if (effectiveRole === 'DEVELOPER') {
        if (user.permissions?.canSubmitRequirements === true) {
          return { allowed: true };
        }
        return {
          allowed: false,
          code: 'ROLE_INSUFFICIENT',
          reason: 'Developers can propose draft requirements, but submission for review requires Manager or Author authorization.',
        };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'You do not have permission to submit this requirement for review.',
      };
    }

    case 'review': {
      if (resource && resource.workflowStatus !== 'PENDING_REVIEW') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement must be in PENDING_REVIEW status to be reviewed.',
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
        reason: 'Only designated reviewers or managers can review this requirement.',
      };
    }

    case 'approve':
    case 'reject': {
      // Author check already handled in Tier 3
      if (resource && resource.workflowStatus !== 'PENDING_REVIEW') {
        return {
          allowed: false,
          code: 'INVALID_STATUS_TRANSITION',
          reason: 'Requirement must be in PENDING_REVIEW status to be approved or rejected.',
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
        reason: 'Only authorized reviewers or managers can approve or reject requirements.',
      };
    }

    case 'create_linked_task': {
      if (effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || effectiveRole === 'DEVELOPER') {
        return { allowed: true };
      }
      if (user.permissions?.canLinkTasks === true) {
        return { allowed: true };
      }
      return {
        allowed: false,
        code: 'ROLE_INSUFFICIENT',
        reason: 'You do not have permission to link tasks to this requirement.',
      };
    }

    case 'archive': {
      if (effectiveRole === 'OWNER') {
        return { allowed: true };
      }
      if (effectiveRole === 'MANAGER' && (user.isProjectOwner || user.projectRole === 'MANAGER')) {
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
