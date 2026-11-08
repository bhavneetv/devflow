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
} from 'lucide-react';

export type SubmoduleType = 'built_in' | 'custom';

export interface ProjectSubmodule {
  id: number;
  projectId: number;
  moduleId: number;
  name: string;
  icon: string | null;
  type: SubmoduleType;
  builtInKey: string | null;
  position: number;
  isVisible: boolean;
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
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
  submodules?: ProjectSubmodule[];
}

export interface CreateModuleInput {
  name: string;
  description?: string | null;
  icon?: string;
  isVisible?: boolean;
}

export interface UpdateModuleInput {
  name?: string;
  description?: string | null;
  icon?: string;
  isVisible?: boolean;
  position?: number;
}

export interface CreateSubmoduleInput {
  name: string;
  icon?: string;
  type?: SubmoduleType;
  builtInKey?: string | null;
  isVisible?: boolean;
}

export interface UpdateSubmoduleInput {
  name?: string;
  icon?: string;
  isVisible?: boolean;
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
    key: 'issues',
    defaultName: 'Issues',
    description: 'Track bugs, tasks, and feature requests',
    defaultIcon: 'circle-dot',
    iconComponent: CircleDot,
    subpath: 'issues',
  },
  {
    key: 'docs',
    defaultName: 'Documents',
    description: 'Project technical specs, wikis, and guidelines',
    defaultIcon: 'file-text',
    iconComponent: FileText,
    subpath: 'docs',
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
];

