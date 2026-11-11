import { LucideIcon } from 'lucide-react';
import {
  CircleDot,
  FileText,
  GitFork,
  GitPullRequest,
  CheckSquare,
  AlertCircle,
  Activity,
  Kanban,
  Flag,
  RotateCcw,
  LayoutDashboard,
  GitCommit,
  Code2,
  PenTool,
} from 'lucide-react';

export type SubmoduleType = 'built_in' | 'custom' | 'composite';

export interface ProjectSubmodule {
  id: number;
  projectId: number;
  moduleId: number;
  name: string;
  icon: string | null;
  type: SubmoduleType;
  builtInKey: string | null;
  config?: string | null;
  position: number;
  isVisible: boolean;
  isPinned?: boolean;
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectModule {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  isVisible: boolean;
  isPinned?: boolean;
  parentId?: number | null;
  children?: ProjectModule[];
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
  submodules?: ProjectSubmodule[];
}

export interface CreateModuleInput {
  name: string;
  description?: string | null;
  icon?: string;
  parentId?: number | null;
  isVisible?: boolean;
  isPinned?: boolean;
}

export interface UpdateModuleInput {
  name?: string;
  description?: string | null;
  icon?: string;
  parentId?: number | null;
  isVisible?: boolean;
  isPinned?: boolean;
  position?: number;
}

export interface CreateSubmoduleInput {
  name: string;
  icon?: string;
  type?: SubmoduleType;
  builtInKey?: string | null;
  config?: string | null;
  isVisible?: boolean;
  isPinned?: boolean;
}

export interface UpdateSubmoduleInput {
  name?: string;
  icon?: string;
  type?: SubmoduleType;
  builtInKey?: string | null;
  config?: string | null;
  isVisible?: boolean;
  isPinned?: boolean;
  position?: number;
}

export interface BuiltInSubmoduleDefinition {
  key: string;
  defaultName: string;
  description: string;
  defaultIcon: string;
  iconComponent: LucideIcon;
  subpath: string;
}

export const BUILT_IN_SUBMODULE_DEFINITIONS: BuiltInSubmoduleDefinition[] = [
  {
    key: 'overview',
    defaultName: 'Project Overview',
    description: 'Project summary dashboard, metrics, and timeline',
    defaultIcon: 'layout-dashboard',
    iconComponent: LayoutDashboard,
    subpath: '',
  },
  {
    key: 'git-overview',
    defaultName: 'Git Overview',
    description: 'Aggregated Git repository stats, pull requests, and activity feed',
    defaultIcon: 'layout-dashboard',
    iconComponent: LayoutDashboard,
    subpath: 'git-overview',
  },
  {
    key: 'issues',
    defaultName: 'Issues',
    description: 'Track bugs, tasks, and feature requests',
    defaultIcon: 'circle-dot',
    iconComponent: CircleDot,
    subpath: 'issues',
  },
  {
    key: 'documents.knowledge_base',
    defaultName: 'Documents & Knowledge',
    description: 'Project documents, assets, and technical specs stored in a dedicated private GitHub repository',
    defaultIcon: 'file-text',
    iconComponent: FileText,
    subpath: 'documents',
  },
  {
    key: 'docs',
    defaultName: 'Documents',
    description: 'Project technical specs, wikis, and guidelines',
    defaultIcon: 'file-text',
    iconComponent: FileText,
    subpath: 'documents',
  },
  {
    key: 'repositories',
    defaultName: 'Git Repositories',
    description: 'Source code repositories and branches',
    defaultIcon: 'git-fork',
    iconComponent: GitFork,
    subpath: 'repositories',
  },
  {
    key: 'pulls',
    defaultName: 'Merge Requests',
    description: 'Code review and branch merging workflow',
    defaultIcon: 'git-pull-request',
    iconComponent: GitPullRequest,
    subpath: 'pulls',
  },
  {
    key: 'git-commits',
    defaultName: 'Commits',
    description: 'Commit log, author timelines, and changeset inspector',
    defaultIcon: 'git-commit',
    iconComponent: GitCommit,
    subpath: 'commits',
  },
  {
    key: 'git-code',
    defaultName: 'Source Code',
    description: 'Online VS Code source code browser powered by Monaco',
    defaultIcon: 'code-2',
    iconComponent: Code2,
    subpath: 'code',
  },
  {
    key: 'test-cases',
    defaultName: 'Test Cases',
    description: 'QA test scenarios and test plans',
    defaultIcon: 'check-square',
    iconComponent: CheckSquare,
    subpath: 'test-cases',
  },
  {
    key: 'defects',
    defaultName: 'Defects',
    description: 'Quality defects, regressions, and triage',
    defaultIcon: 'alert-circle',
    iconComponent: AlertCircle,
    subpath: 'defects',
  },
  {
    key: 'activity',
    defaultName: 'Activity Logs',
    description: 'Audit log of updates, commits, and changes',
    defaultIcon: 'activity',
    iconComponent: Activity,
    subpath: 'activity',
  },
  {
    key: 'board',
    defaultName: 'Kanban Board',
    description: 'Interactive visual workflow lanes',
    defaultIcon: 'kanban',
    iconComponent: Kanban,
    subpath: 'board',
  },
  {
    key: 'milestones',
    defaultName: 'Milestones',
    description: 'Target delivery phases and key release dates',
    defaultIcon: 'flag',
    iconComponent: Flag,
    subpath: 'milestones',
  },
  {
    key: 'cycles',
    defaultName: 'Cycles / Sprints',
    description: 'Time-boxed team development iterations',
    defaultIcon: 'rotate-ccw',
    iconComponent: RotateCcw,
    subpath: 'cycles',
  },
  {
    key: 'whiteboard',
    defaultName: 'Whiteboard',
    description: 'Infinite canvas whiteboard with freehand sketching, shapes, sticky notes, and text',
    defaultIcon: 'pen-tool',
    iconComponent: PenTool,
    subpath: 'whiteboard',
  },
];

