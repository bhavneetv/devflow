export interface OnboardingData {
  displayName: string;
  username: string;
  avatarType: 'initials' | 'icon' | 'upload' | 'preset';
  avatarId: string | null; // e.g. 'smile', 'code', 'bug', etc.
  avatarUrl: string | null;
  avatarColor: string; // Avatar background color (when initials or icon is chosen)
  accentColor: string; // Workspace UI accent color
  role: string | null;
  workspaceType: string | null;
  goals: string[];
  teamSizePreference: string | null;
  startingPreference: 'new_project' | 'github_import' | 'sample' | null;
  projectName: string | null;
  projectDescription: string | null;
  teamName?: string;
  teamMembers?: TeamMemberSetup[];
}

export interface TeamMemberSetup {
  id: string;
  name: string;
  username: string;
  role: string;
  avatarType: 'initials' | 'icon' | 'upload' | 'preset';
  avatarId?: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  isCurrentUser?: boolean;
}

export interface PublicAccountOption {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarType: 'initials' | 'icon' | 'upload' | 'preset';
  avatarId?: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  isPublicProfile: boolean;
  defaultRole?: string;
}

export const MOCK_PUBLIC_ACCOUNTS: PublicAccountOption[] = [
  {
    id: 'u-1',
    name: 'Sarah Chen',
    username: 'sarahc',
    email: 'sarah.chen@devflow.io',
    avatarType: 'icon',
    avatarId: 'code',
    avatarColor: '#059669',
    isPublicProfile: true,
    defaultRole: 'Engineer',
  },
  {
    id: 'u-2',
    name: 'Marcus Vance',
    username: 'marcusv',
    email: 'marcus.v@devflow.io',
    avatarType: 'icon',
    avatarId: 'terminal',
    avatarColor: '#4F46E5',
    isPublicProfile: true,
    defaultRole: 'Lead',
  },
  {
    id: 'u-3',
    name: 'Elena Rostova',
    username: 'elenar',
    email: 'elena.rostova@devflow.io',
    avatarType: 'icon',
    avatarId: 'layers',
    avatarColor: '#C026D3',
    isPublicProfile: true,
    defaultRole: 'Designer',
  },
  {
    id: 'u-4',
    name: 'Liam Becker',
    username: 'liamb',
    email: 'liam.b@devflow.io',
    avatarType: 'icon',
    avatarId: 'cpu',
    avatarColor: '#0284C7',
    isPublicProfile: true,
    defaultRole: 'Engineer',
  },
  {
    id: 'u-5',
    name: 'Priya Patel',
    username: 'priyap',
    email: 'priya.patel@devflow.io',
    avatarType: 'icon',
    avatarId: 'rocket',
    avatarColor: '#D97706',
    isPublicProfile: true,
    defaultRole: 'Product Manager',
  },
  {
    id: 'u-6',
    name: 'David Kim',
    username: 'davidk',
    email: 'david.kim@devflow.io',
    avatarType: 'icon',
    avatarId: 'flame',
    avatarColor: '#E11D48',
    isPublicProfile: true,
    defaultRole: 'Engineer',
  },
  {
    id: 'u-7',
    name: 'Sofia Torres',
    username: 'sofiat',
    email: 'sofia.t@devflow.io',
    avatarType: 'icon',
    avatarId: 'sparkles',
    avatarColor: '#7C3AED',
    isPublicProfile: true,
    defaultRole: 'Designer',
  },
  {
    id: 'u-8',
    name: 'Alex Novak',
    username: 'alexn',
    email: 'alex.novak@devflow.io',
    avatarType: 'icon',
    avatarId: 'zap',
    avatarColor: '#F59E0B',
    isPublicProfile: true,
    defaultRole: 'Engineer',
  },
  {
    id: 'u-9',
    name: 'Private Member',
    username: 'secret_dev',
    email: 'private@devflow.io',
    avatarType: 'initials',
    avatarId: 'initials',
    avatarColor: '#27272A',
    isPublicProfile: false,
    defaultRole: 'Viewer',
  },
];

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  borderHex: string;
}

// Avatar background colors (for icons & initials)
export const AVATAR_COLORS: ColorOption[] = [
  { id: 'violet', name: 'Violet', hex: '#7C3AED', borderHex: '#6D28D9' },
  { id: 'indigo', name: 'Indigo', hex: '#4F46E5', borderHex: '#4338CA' },
  { id: 'cyan', name: 'Cyan', hex: '#0284C7', borderHex: '#0369A1' },
  { id: 'teal', name: 'Teal', hex: '#0D9488', borderHex: '#0F766E' },
  { id: 'emerald', name: 'Emerald', hex: '#059669', borderHex: '#047857' },
  { id: 'amber', name: 'Amber', hex: '#D97706', borderHex: '#B45309' },
  { id: 'rose', name: 'Rose', hex: '#E11D48', borderHex: '#BE123C' },
  { id: 'fuchsia', name: 'Fuchsia', hex: '#C026D3', borderHex: '#A21CAF' },
  { id: 'zinc', name: 'Zinc', hex: '#27272A', borderHex: '#3F3F46' },
];

// DevFlow Workspace UI accent colors (distinct modern developer palette)
export const ACCENT_COLORS: ColorOption[] = [
  { id: 'violet', name: 'Cosmic Violet', hex: '#8B5CF6', borderHex: '#7C3AED' },
  { id: 'indigo', name: 'Electric Indigo', hex: '#6366F1', borderHex: '#4F46E5' },
  { id: 'cyan', name: 'Vibrant Cyan', hex: '#06B6D4', borderHex: '#0891B2' },
  { id: 'emerald', name: 'Clean Emerald', hex: '#10B981', borderHex: '#059669' },
  { id: 'amber', name: 'Warm Amber', hex: '#F59E0B', borderHex: '#D97706' },
  { id: 'rose', name: 'Coral Rose', hex: '#F43F5E', borderHex: '#E11D48' },
  { id: 'lime', name: 'Neon Lime', hex: '#84CC16', borderHex: '#65A30D' },
  { id: 'silver', name: 'Platinum Zinc', hex: '#E4E4E7', borderHex: '#D4D4D8' },
];

// Exactly 5 Quick Avatar Icons displayed on the main page
export interface AvatarIconOption {
  id: string;
  name: string;
  iconName: string;
}

export const QUICK_AVATAR_ICONS: AvatarIconOption[] = [
  { id: 'smile', name: 'Smile', iconName: 'Smile' },
  { id: 'code', name: 'Code', iconName: 'Code2' },
  { id: 'bug', name: 'Bug', iconName: 'Bug' },
  { id: 'terminal', name: 'Terminal', iconName: 'Terminal' },
  { id: 'zap', name: 'Zap', iconName: 'Zap' },
];

// Rich collection of 28 developer emojis/icons inside the 3-dot popup with scrollbar
export const MORE_AVATAR_ICONS: AvatarIconOption[] = [
  { id: 'rocket', name: 'Rocket', iconName: 'Rocket' },
  { id: 'cpu', name: 'Cpu', iconName: 'Cpu' },
  { id: 'layers', name: 'Layers', iconName: 'Layers' },
  { id: 'compass', name: 'Compass', iconName: 'Compass' },
  { id: 'shield', name: 'Shield', iconName: 'Shield' },
  { id: 'flame', name: 'Flame', iconName: 'Flame' },
  { id: 'git-branch', name: 'Branch', iconName: 'GitBranch' },
  { id: 'database', name: 'Database', iconName: 'Database' },
  { id: 'glasses', name: 'Glasses', iconName: 'Glasses' },
  { id: 'coffee', name: 'Coffee', iconName: 'Coffee' },
  { id: 'heart', name: 'Heart', iconName: 'Heart' },
  { id: 'bot', name: 'Bot', iconName: 'Bot' },
  { id: 'gamepad', name: 'Gamepad', iconName: 'Gamepad2' },
  { id: 'atom', name: 'Atom', iconName: 'Atom' },
  { id: 'cloud', name: 'Cloud', iconName: 'Cloud' },
  { id: 'key', name: 'Key', iconName: 'Key' },
  { id: 'globe', name: 'Globe', iconName: 'Globe' },
  { id: 'sparkles', name: 'Sparkles', iconName: 'Sparkles' },
  { id: 'laptop', name: 'Laptop', iconName: 'Laptop' },
  { id: 'fingerprint', name: 'Fingerprint', iconName: 'Fingerprint' },
  { id: 'feather', name: 'Feather', iconName: 'Feather' },
  { id: 'ghost', name: 'Ghost', iconName: 'Ghost' },
  { id: 'moon', name: 'Moon', iconName: 'Moon' },
  { id: 'sun', name: 'Sun', iconName: 'Sun' },
  { id: 'activity', name: 'Activity', iconName: 'Activity' },
  { id: 'wifi', name: 'Wifi', iconName: 'Wifi' },
  { id: 'package', name: 'Package', iconName: 'Package' },
  { id: 'wrench', name: 'Wrench', iconName: 'Wrench' },
];

export interface RoleOption {
  id: string;
  title: string;
  category: string;
  iconName: string;
  description: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'software-developer', title: 'Software Developer', category: 'Engineering', iconName: 'Code', description: 'General software systems & apps' },
  { id: 'frontend-developer', title: 'Frontend Developer', category: 'Engineering', iconName: 'Layout', description: 'React, interfaces & client apps' },
  { id: 'backend-developer', title: 'Backend Developer', category: 'Engineering', iconName: 'Server', description: 'APIs, microservices & databases' },
  { id: 'fullstack-developer', title: 'Full-Stack Developer', category: 'Engineering', iconName: 'Layers', description: 'End-to-end full stack execution' },
  { id: 'engineering-lead', title: 'Engineering Lead', category: 'Leadership', iconName: 'Compass', description: 'Architecture & technical delivery' },
  { id: 'engineering-manager', title: 'Engineering Manager', category: 'Leadership', iconName: 'Users', description: 'People, team pacing & organization' },
  { id: 'project-manager', title: 'Project Manager', category: 'Management', iconName: 'Kanban', description: 'Roadmaps, milestones & tracking' },
  { id: 'qa-engineer', title: 'QA Engineer', category: 'Quality', iconName: 'CheckCircle2', description: 'Test suites, bug verification & CI' },
  { id: 'devops-engineer', title: 'DevOps Engineer', category: 'Infrastructure', iconName: 'Terminal', description: 'Pipelines, Kubernetes & cloud ops' },
  { id: 'ui-ux-designer', title: 'UI/UX Designer', category: 'Design', iconName: 'Palette', description: 'Design systems, tokens & UX' },
  { id: 'product-manager', title: 'Product Manager', category: 'Product', iconName: 'Briefcase', description: 'Product spec, customer needs & metrics' },
  { id: 'student', title: 'Student', category: 'Academic', iconName: 'GraduationCap', description: 'Learning software craftsmanship' },
  { id: 'freelancer', title: 'Freelancer', category: 'Contract', iconName: 'Laptop', description: 'Independent consultant & builder' },
  { id: 'other', title: 'Other', category: 'General', iconName: 'Sparkles', description: 'Custom role in technology' },
];

export interface WorkspaceTypeOption {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export const WORKSPACE_TYPES: WorkspaceTypeOption[] = [
  { id: 'solo', title: 'Just me', description: 'Solo maker, individual projects & personal flow', iconName: 'User' },
  { id: 'startup', title: 'My startup', description: 'Fast-moving team building modern SaaS', iconName: 'Rocket' },
  { id: 'company', title: 'My company', description: 'Established company with multi-team delivery', iconName: 'Building2' },
  { id: 'agency', title: 'An agency', description: 'Client work, deliverables & parallel milestones', iconName: 'Layers' },
  { id: 'open-source', title: 'An open-source project', description: 'Community collaboration, issues & PRs', iconName: 'Globe' },
  { id: 'academic', title: 'A student or academic team', description: 'Hackathons, course capstones & lab projects', iconName: 'GraduationCap' },
];

export interface GoalOption {
  id: string;
  title: string;
  description: string;
  iconName: string;
  previewTag: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  { id: 'tasks', title: 'Projects and tasks', description: 'Kanban boards, sprint backlogs & issue tracker', iconName: 'CheckSquare', previewTag: 'Board' },
  { id: 'github', title: 'GitHub repositories and pull requests', description: 'Live repo sync, branch statuses & PR reviews', iconName: 'GitPullRequest', previewTag: 'Git Sync' },
  { id: 'testing', title: 'Bugs and testing', description: 'Automated test results, triage & bug reports', iconName: 'Bug', previewTag: 'QA Suite' },
  { id: 'sprints', title: 'Sprints and team planning', description: 'Velocity curves, roadmap estimates & assignments', iconName: 'Calendar', previewTag: 'Sprints' },
  { id: 'releases', title: 'Releases and deployments', description: 'Production milestones, changelogs & tags', iconName: 'Ship', previewTag: 'CI/CD' },
  { id: 'ai', title: 'AI-powered development assistance', description: 'Copilot task breakdown, code diffs & specs', iconName: 'Bot', previewTag: 'AI Copilot' },
];

export interface TeamSizeOption {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export const TEAM_SIZES: TeamSizeOption[] = [
  { id: 'solo', title: 'Just me', description: 'Individual developer', iconName: 'User' },
  { id: 'small', title: 'A small team (2–5 people)', description: 'Agile squad with high speed', iconName: 'Users' },
  { id: 'growing', title: 'A growing team (6–20 people)', description: 'Multi-discipline project team', iconName: 'Users2' },
  { id: 'large', title: 'A larger organization (21+ people)', description: 'Enterprise departments & squads', iconName: 'Building' },
];

export interface StartingOption {
  id: 'new_project' | 'github_import' | 'sample';
  title: string;
  description: string;
  iconName: string;
  badge?: string;
}

export const STARTING_OPTIONS: StartingOption[] = [
  {
    id: 'new_project',
    title: 'Create a new project',
    description: 'Start with a fresh workspace and define your first initiative.',
    iconName: 'PlusCircle',
  },
  {
    id: 'github_import',
    title: 'Import an existing GitHub repository',
    description: 'Connect repository to auto-import issues, PRs, and branch status.',
    iconName: 'GitFork',
    badge: 'Popular',
  },
  {
    id: 'sample',
    title: 'Explore a sample project',
    description: 'Pre-populated with modern task boards, milestones, and code cards.',
    iconName: 'Sparkles',
    badge: 'Instant preview',
  },
];
