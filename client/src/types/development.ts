export interface DevUser {
  id: number;
  name: string;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarType?: string | null;
  avatarId?: string | null;
  jobTitle?: string | null;
  projectRole?: string;
}

export type DevTaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type DevEffortUnit = 'hours' | 'story_points';

export const DEFAULT_DEV_TASK_TYPES = [
  'Task',
  'Feature',
  'Bug',
  'Improvement',
  'Technical Debt',
] as const;

export const DEFAULT_DEV_STATUSES = [
  'Not Started',
  'In Progress',
  'In Review',
  'Blocked',
  'Completed',
] as const;

export const DEV_PRIORITIES: DevTaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];

export interface DevelopmentSubmoduleMaster {
  id: number;
  projectId: number;
  moduleId: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  position: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
}

export interface DevelopmentModuleMaster {
  id: number;
  projectId: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  position: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
  submodules: DevelopmentSubmoduleMaster[];
}

export interface DevelopmentTaskAttachment {
  id: number;
  taskId: number;
  projectId: number;
  documentId?: number | null;
  fileName: string;
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedBy?: DevUser | null;
  document?: {
    id: number;
    displayName: string;
    originalName: string;
    mimeType: string;
    extension: string;
    sizeBytes: number;
  } | null;
  createdAt: string;
}

export interface DevelopmentTaskComment {
  id: number;
  taskId: number;
  authorId: number;
  author: DevUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentTaskActivity {
  id: number;
  projectId: number;
  taskId?: number | null;
  taskKey?: string;
  taskTitle?: string;
  actorId?: number | null;
  actor?: DevUser | null;
  action: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface DevelopmentTaskItem {
  id: number;
  projectId: number;
  taskKey: string;
  sequenceNumber: number;
  title: string;
  description?: string | null;
  taskType: string;
  moduleId: number;
  module: {
    id: number;
    name: string;
    color?: string | null;
    icon?: string | null;
    isArchived: boolean;
  };
  submoduleId: number;
  submodule: {
    id: number;
    name: string;
    moduleId: number;
    icon?: string | null;
    isArchived: boolean;
  };
  priority: DevTaskPriority;
  status: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedEffort?: number | null;
  effortUnit: DevEffortUnit;
  actualEffort?: number | null;
  labels: string[];
  position: number;
  createdById: number;
  createdBy: DevUser;
  assignees: DevUser[];
  attachments?: DevelopmentTaskAttachment[];
  commentCount: number;
  attachmentCount: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentProjectConfig {
  taskPrefix: string;
  taskTypes: string[];
  statuses: string[];
  defaultEffortUnit: DevEffortUnit;
}

export interface TeamWorkloadItem {
  user: DevUser;
  activeCount: number;
  completedCount: number;
  overdueCount: number;
  totalAssigned: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  completedCount?: number;
  percentage: number;
  color?: string;
}

export interface ModuleProgressItem {
  id: number;
  name: string;
  color?: string | null;
  isArchived: boolean;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  submodules: {
    id: number;
    name: string;
    isArchived: boolean;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  }[];
}

export interface DevelopmentDashboardData {
  projectMeta: {
    id: number;
    title: string;
    identifier?: string | null;
    status: string;
    lead?: DevUser | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  permissions: {
    canEditTasks: boolean;
    canManageMasters: boolean;
    role: string;
  };
  config: DevelopmentProjectConfig;
  eligibleMembers: DevUser[];
  metrics: {
    totalWorkItems: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
    inReviewCount: number;
    blockedCount: number;
    overdueCount: number;
    dueSoonCount: number;
    completionRate: number;
    unassignedCount: number;
    recentCompletedDelta: number | null;
    recentCreatedCount: number;
    teamWorkload: TeamWorkloadItem[];
  };
  analytics: {
    byStatus: BreakdownItem[];
    byPriority: BreakdownItem[];
    byTaskType: BreakdownItem[];
    moduleProgress: ModuleProgressItem[];
    recentlyUpdatedTasks: DevelopmentTaskItem[];
    overdueTasks: DevelopmentTaskItem[];
    dueSoonTasks: DevelopmentTaskItem[];
  };
}

export interface DevelopmentTaskListParams {
  search?: string;
  moduleId?: number;
  submoduleId?: number;
  assigneeId?: number | 'unassigned';
  priority?: string;
  status?: string;
  taskType?: string;
  metric?: 'overdue' | 'due_soon';
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
  sortBy?: 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title' | 'sequenceNumber';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface DevelopmentTaskListResponse {
  items: DevelopmentTaskItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateDevelopmentTaskPayload {
  title: string;
  description?: string | null;
  taskType: string;
  moduleId: number;
  submoduleId: number;
  assigneeIds?: number[];
  priority?: DevTaskPriority;
  status?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedEffort?: number | null;
  effortUnit?: DevEffortUnit;
  actualEffort?: number | null;
  labels?: string[];
  attachmentDocumentIds?: number[];
  externalAttachments?: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number }[];
}

export interface UpdateDevelopmentTaskPayload extends Partial<CreateDevelopmentTaskPayload> {}

