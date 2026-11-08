import {
  Inbox,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Activity,
  Settings,
  HelpCircle,
  Layers,
  LayoutGrid,
  CircleDot,
  Kanban,
  RotateCcw,
  Flag,
  GitFork,
  GitCommit,
  GitPullRequest,
  AlertCircle,
  PlayCircle,
  FileText,
  LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  title: string;
  path: string;
  icon?: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'subtle' | 'accent';
  purpose?: string;
  order: number;
}

export interface NavGroupConfig {
  id: string;
  title: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  items: NavItemConfig[];
}

export interface FavoriteItem {
  id: string;
  title: string;
  path: string;
  iconType: 'layers' | 'grid' | 'folder' | 'circle';
  teamId?: string;
}

export interface TeamNavConfig {
  id: string;
  name: string;
  color: string;
  icon?: LucideIcon;
  defaultExpanded?: boolean;
  sections: {
    id: string;
    title: string;
    path: string;
    icon: LucideIcon;
    subItems?: {
      id: string;
      title: string;
      path: string;
      badge?: number;
    }[];
  }[];
}

export const defaultTeams: TeamNavConfig[] = [
  {
    id: 'engineering',
    name: 'Engineering',
    color: '#3B82F6',
    defaultExpanded: true,
    sections: [
      {
        id: 'eng-issues',
        title: 'Issues',
        path: '/teams/engineering/issues',
        icon: CircleDot,
        subItems: [
          { id: 'eng-active', title: 'Active', path: '/teams/engineering/issues/active', badge: 12 },
          { id: 'eng-backlog', title: 'Backlog', path: '/teams/engineering/issues/backlog', badge: 28 },
        ],
      },
      { id: 'eng-projects', title: 'Projects', path: '/teams/engineering/projects', icon: LayoutGrid },
      { id: 'eng-views', title: 'Views', path: '/teams/engineering/views', icon: Layers },
    ],
  },
  {
    id: 'design',
    name: 'Design',
    color: '#EC4899',
    defaultExpanded: false,
    sections: [
      {
        id: 'design-issues',
        title: 'Issues',
        path: '/teams/design/issues',
        icon: CircleDot,
        subItems: [
          { id: 'design-active', title: 'Active', path: '/teams/design/issues/active', badge: 4 },
          { id: 'design-backlog', title: 'Backlog', path: '/teams/design/issues/backlog', badge: 9 },
        ],
      },
      { id: 'design-projects', title: 'Projects', path: '/teams/design/projects', icon: LayoutGrid },
      { id: 'design-views', title: 'Views', path: '/teams/design/views', icon: Layers },
    ],
  },
  {
    id: 'product',
    name: 'Product',
    color: '#10B981',
    defaultExpanded: false,
    sections: [
      {
        id: 'product-issues',
        title: 'Issues',
        path: '/teams/product/issues',
        icon: CircleDot,
        subItems: [
          { id: 'product-active', title: 'Active', path: '/teams/product/issues/active', badge: 6 },
          { id: 'product-backlog', title: 'Backlog', path: '/teams/product/issues/backlog', badge: 15 },
        ],
      },
      { id: 'product-projects', title: 'Projects', path: '/teams/product/projects', icon: LayoutGrid },
      { id: 'product-views', title: 'Views', path: '/teams/product/views', icon: Layers },
    ],
  },
];

// Strictly ordered Workspace Navigation items according to requirements:
// 1. Inbox - Notifications and assigned updates
// 2. Overview - Workspace dashboard
// 3. Projects - All workspace projects
// 4. My Tasks - Tasks assigned to me
// 5. Teams - Manage workspace teams
// 6. Activity - Workspace-wide activity
export const mainWorkspaceNavItems: NavItemConfig[] = [
  {
    order: 1,
    id: 'inbox',
    title: 'Inbox',
    path: '/inbox',
    icon: Inbox,
    badge: 7,
    badgeVariant: 'subtle',
    purpose: 'Notifications and assigned updates',
  },
  {
    order: 2,
    id: 'overview',
    title: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    purpose: 'Workspace dashboard',
  },
  {
    order: 3,
    id: 'projects',
    title: 'Projects',
    path: '/projects',
    icon: FolderKanban,
    badge: 2,
    purpose: 'All workspace projects',
  },
  {
    order: 4,
    id: 'requirements',
    title: 'Requirements',
    path: '/requirements',
    icon: FileText,
    purpose: 'Specifications and requirements management',
  },
  {
    order: 5,
    id: 'my-tasks',
    title: 'My Tasks',
    path: '/my-tasks',
    icon: CheckSquare,
    purpose: 'Tasks assigned to me',
  },
  {
    order: 6,
    id: 'teams',
    title: 'Teams',
    path: '/teams',
    icon: Users,
    purpose: 'Manage workspace teams',
  },
  {
    order: 7,
    id: 'activity',
    title: 'Activity',
    path: '/activity',
    icon: Activity,
    purpose: 'Workspace-wide activity',
  },
];

// Bottom workspace items:
// 7. Settings - Workspace configuration
// 8. Help & Support - Documentation and support
export const bottomWorkspaceNavItems: NavItemConfig[] = [
  {
    order: 7,
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    icon: Settings,
    purpose: 'Workspace configuration',
  },
  {
    order: 8,
    id: 'help',
    title: 'Help & Support',
    path: '/help',
    icon: HelpCircle,
    purpose: 'Documentation and support',
  },
];

// Initial user-managed favorites
export const initialFavorites: FavoriteItem[] = [
  { id: 'fav-design', title: 'Design Team', path: '/teams/design', iconType: 'layers' },
  { id: 'fav-dev', title: 'Development Team', path: '/teams/engineering', iconType: 'layers' },
  { id: 'fav-marketing', title: 'Marketing Team', path: '/teams/marketing', iconType: 'layers' },
  { id: 'fav-sales', title: 'Sales Team', path: '/teams/sales', iconType: 'grid' },
];

// Project Navigation Structure (Project Context Mode)
export function getProjectNavGroups(projectId: number | string): NavGroupConfig[] {
  const base = `/projects/${projectId}`;
  return [
    {
      id: 'project-core',
      title: 'PROJECT',
      collapsible: false,
      items: [
        { order: 1, id: 'p-overview', title: 'Project Overview', path: `${base}`, icon: LayoutDashboard },
        { order: 2, id: 'p-requirements', title: 'Requirements', path: `${base}/requirements`, icon: FileText },
        { order: 3, id: 'p-issues', title: 'Issues', path: `${base}/issues`, icon: CircleDot, badge: 8 },
        { order: 4, id: 'p-board', title: 'Board', path: `${base}/board`, icon: Kanban },
        { order: 5, id: 'p-cycles', title: 'Cycles / Sprints', path: `${base}/cycles`, icon: RotateCcw },
        { order: 6, id: 'p-milestones', title: 'Milestones', path: `${base}/milestones`, icon: Flag },
      ],
    },
    {
      id: 'project-dev',
      title: 'DEVELOPMENT',
      collapsible: true,
      defaultExpanded: true,
      items: [
        { order: 6, id: 'p-repos', title: 'Repositories', path: `${base}/repositories`, icon: GitFork },
        { order: 7, id: 'p-commits', title: 'Commits', path: `${base}/commits`, icon: GitCommit },
        { order: 8, id: 'p-prs', title: 'Pull Requests', path: `${base}/pulls`, icon: GitPullRequest, badge: 2 },
      ],
    },
    {
      id: 'project-quality',
      title: 'QUALITY',
      collapsible: true,
      defaultExpanded: true,
      items: [
        { order: 9, id: 'p-defects', title: 'Defects', path: `${base}/defects`, icon: AlertCircle },
        { order: 10, id: 'p-test-cases', title: 'Test Cases', path: `${base}/test-cases`, icon: CheckSquare },
        { order: 11, id: 'p-test-runs', title: 'Test Runs', path: `${base}/test-runs`, icon: PlayCircle },
      ],
    },
    {
      id: 'project-mgmt',
      title: 'PROJECT MANAGEMENT',
      collapsible: true,
      defaultExpanded: false,
      items: [
        { order: 12, id: 'p-members', title: 'Members', path: `${base}/members`, icon: Users },
        { order: 13, id: 'p-docs', title: 'Documentation', path: `${base}/docs`, icon: FileText },
        { order: 14, id: 'p-activity', title: 'Activity Log', path: `${base}/activity`, icon: Activity },
      ],
    },
  ];
}
