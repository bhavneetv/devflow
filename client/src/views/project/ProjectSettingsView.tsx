import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  FolderKanban,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Terminal,
  Layers,
  Cpu,
  Smile,
  Zap,
  MoreHorizontal,
  X,
  Code2,
  Database,
  Flame,
  Shield,
  Clock,
  Compass,
  Boxes,
  Globe,
  Plus,
  GitBranch,
  Sliders,
  ShieldCheck,
  Tags,
  Activity,
  Tag,
  Lock,
  Unlock,
  Users,
  ExternalLink,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Eye,
  Archive,
  RefreshCw,
  Send,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useNavigation } from '../../context/NavigationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useToast } from '../../context/ToastContext';
import { organizationService } from '../../services/organization.service';
import { apiUrl } from '../../config/api';
import { AnimatedSelect, AnimatedMultiSelect, SelectOption } from '../../components/settings/AnimatedSelect';
import { CustomDatePicker } from '../../components/settings/CustomDatePicker';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { AccountSettingsLayout } from '../../components/settings/AccountSettingsLayout';
import { ProjectStructureView } from './ProjectStructureView';
import { SidebarOrderSettingsView } from './SidebarOrderSettingsView';
import { ProjectGitHubLinker } from '../../components/git/ProjectGitHubLinker';
import { ProjectGitMemberMapping } from '../../components/git/ProjectGitMemberMapping';
import { ProjectStorageSettingsTab } from '../../components/settings/ProjectStorageSettingsTab';

// ─── CONSTANTS & DICTIONARIES ────────────────────────────────────────────────

interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

const AVATAR_COLORS: ColorOption[] = [
  { id: 'violet', name: 'Violet', hex: '#8B5CF6' },
  { id: 'indigo', name: 'Indigo', hex: '#6366F1' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'emerald', name: 'Emerald', hex: '#10B981' },
  { id: 'amber', name: 'Amber', hex: '#F59E0B' },
  { id: 'rose', name: 'Rose', hex: '#F43F5E' },
  { id: 'pink', name: 'Pink', hex: '#EC4899' },
  { id: 'cyan', name: 'Cyan', hex: '#06B6D4' },
];

const QUICK_AVATAR_ICONS = [
  { id: 'folder', name: 'Folder' },
  { id: 'sparkles', name: 'Sparkles' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'layers', name: 'Layers' },
  { id: 'cpu', name: 'CPU' },
  { id: 'zap', name: 'Zap' },
];

const MORE_AVATAR_ICONS = [
  { id: 'code', name: 'Code' },
  { id: 'database', name: 'Database' },
  { id: 'flame', name: 'Flame' },
  { id: 'shield', name: 'Shield' },
  { id: 'clock', name: 'Clock' },
  { id: 'compass', name: 'Compass' },
  { id: 'boxes', name: 'Boxes' },
  { id: 'globe', name: 'Globe' },
  { id: 'smile', name: 'Smile' },
];

const AVATAR_ICON_COMPONENTS: Record<string, LucideIcon> = {
  folder: FolderKanban,
  sparkles: Sparkles,
  terminal: Terminal,
  layers: Layers,
  cpu: Cpu,
  zap: Zap,
  code: Code2,
  database: Database,
  flame: Flame,
  shield: Shield,
  clock: Clock,
  compass: Compass,
  boxes: Boxes,
  globe: Globe,
  smile: Smile,
};

const PREDEFINED_CATEGORIES = [
  'General',
  'Frontend',
  'Backend',
  'Fullstack',
  'Mobile',
  'DevOps',
  'Infrastructure',
  'Design / UI',
  'Research',
  'Marketing',
  'Security',
  'AI / ML',
  'Data / Analytics',
];

const STATUS_OPTIONS = [
  {
    id: 'BACKLOG',
    label: 'Backlog',
    color: '#71717A',
    description: 'Ideas, prospective work, and unprioritized initiatives',
  },
  {
    id: 'PLANNED',
    label: 'Planned',
    color: '#3B82F6',
    description: 'Approved and scoped work ready for development sprint',
  },
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    color: '#8B5CF6',
    description: 'Actively in engineering and implementation',
  },
  {
    id: 'IN_REVIEW',
    label: 'In Review',
    color: '#F59E0B',
    description: 'Under peer review, QA validation, or staging deployment',
  },
  {
    id: 'COMPLETED',
    label: 'Completed',
    color: '#10B981',
    description: 'Delivered and verified in production',
  },
  {
    id: 'CANCELLED',
    label: 'Cancelled',
    color: '#EF4444',
    description: 'Halted or abandoned without delivery',
  },
];

const PRIORITY_OPTIONS = [
  { id: 'LOW', label: 'Low Priority', color: '#71717A' },
  { id: 'MEDIUM', label: 'Medium Priority', color: '#3B82F6' },
  { id: 'HIGH', label: 'High Priority', color: '#F59E0B' },
  { id: 'URGENT', label: 'Urgent Priority', color: '#EF4444' },
];

const LABEL_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#64748B',
];

interface WorkspaceUser {
  id: number;
  name: string;
  email: string;
  username?: string;
  avatarColor?: string;
  avatarUrl?: string;
  avatarType?: 'icon' | 'initials';
  avatarId?: string;
}

interface OrganizationTeam {
  id: number;
  name: string;
  description?: string;
  color?: string;
  avatarIcon?: string;
}

interface CustomLabelItem {
  id: string;
  name: string;
  color: string;
}

// ─── METADATA SERIALIZERS & PARSERS ──────────────────────────────────────────

function parseTeamMetadata(rawDesc?: string, teamName?: string) {
  let cleanDesc = rawDesc || '';
  let key = '';
  let icon = 'users';

  if (cleanDesc) {
    const keyMatch = cleanDesc.match(/\[key:([A-Za-z0-9_-]{1,10})\]/);
    if (keyMatch) {
      key = keyMatch[1];
      cleanDesc = cleanDesc.replace(keyMatch[0], '').trim();
    }
    const iconMatch = cleanDesc.match(/\[icon:([a-z0-9_-]+)\]/);
    if (iconMatch) {
      icon = iconMatch[1];
      cleanDesc = cleanDesc.replace(iconMatch[0], '').trim();
    }
  }

  if (!key && teamName) {
    const words = teamName.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      key = words.slice(0, 4).map((w) => w[0]?.toUpperCase()).join('').slice(0, 5);
    } else {
      key = teamName.slice(0, 3).toUpperCase();
    }
  }

  return { key: key || 'TEAM', icon, cleanDesc };
}

function parseProjectMetadata(description?: string | null) {
  let cleanDesc = description || '';
  let brief = '';
  let gitRepo = '';
  let slackWebhook = '';
  let discordWebhook = '';
  let productionUrl = '';
  let stagingUrl = '';
  let visibility = 'internal';
  let requireLeadApproval = false;
  let allowMemberCustomLabels = true;
  let customLabels: CustomLabelItem[] = [
    { id: '1', name: 'bug', color: '#EF4444' },
    { id: '2', name: 'feature', color: '#10B981' },
    { id: '3', name: 'documentation', color: '#3B82F6' },
    { id: '4', name: 'refactor', color: '#8B5CF6' },
    { id: '5', name: 'performance', color: '#F59E0B' },
  ];

  if (cleanDesc) {
    const briefMatch = cleanDesc.match(/\[brief:([^\]]+)\]/);
    if (briefMatch) {
      brief = briefMatch[1];
      cleanDesc = cleanDesc.replace(briefMatch[0], '').trim();
    }
    const gitMatch = cleanDesc.match(/\[git:([^\]]+)\]/);
    if (gitMatch) {
      gitRepo = gitMatch[1];
      cleanDesc = cleanDesc.replace(gitMatch[0], '').trim();
    }
    const slackMatch = cleanDesc.match(/\[slack:([^\]]+)\]/);
    if (slackMatch) {
      slackWebhook = slackMatch[1];
      cleanDesc = cleanDesc.replace(slackMatch[0], '').trim();
    }
    const discordMatch = cleanDesc.match(/\[discord:([^\]]+)\]/);
    if (discordMatch) {
      discordWebhook = discordMatch[1];
      cleanDesc = cleanDesc.replace(discordMatch[0], '').trim();
    }
    const prodMatch = cleanDesc.match(/\[prodUrl:([^\]]+)\]/);
    if (prodMatch) {
      productionUrl = prodMatch[1];
      cleanDesc = cleanDesc.replace(prodMatch[0], '').trim();
    }
    const stageMatch = cleanDesc.match(/\[stagingUrl:([^\]]+)\]/);
    if (stageMatch) {
      stagingUrl = stageMatch[1];
      cleanDesc = cleanDesc.replace(stageMatch[0], '').trim();
    }
    const visMatch = cleanDesc.match(/\[vis:(public|internal|private)\]/);
    if (visMatch) {
      visibility = visMatch[1];
      cleanDesc = cleanDesc.replace(visMatch[0], '').trim();
    }
    const leadApprMatch = cleanDesc.match(/\[leadApproval:(true|false)\]/);
    if (leadApprMatch) {
      requireLeadApproval = leadApprMatch[1] === 'true';
      cleanDesc = cleanDesc.replace(leadApprMatch[0], '').trim();
    }
    const labelsMatch = cleanDesc.match(/\[customLabels:([^\]]+)\]/);
    if (labelsMatch) {
      try {
        const parsed = JSON.parse(decodeURIComponent(labelsMatch[1]));
        if (Array.isArray(parsed) && parsed.length > 0) {
          customLabels = parsed;
        }
      } catch (e) {}
      cleanDesc = cleanDesc.replace(labelsMatch[0], '').trim();
    }
  }

  return {
    cleanDesc,
    brief,
    gitRepo,
    slackWebhook,
    discordWebhook,
    productionUrl,
    stagingUrl,
    visibility,
    requireLeadApproval,
    allowMemberCustomLabels,
    customLabels,
  };
}

function serializeProjectDescription(
  cleanDesc: string,
  meta?: {
    brief?: string;
    gitRepo?: string;
    slackWebhook?: string;
    discordWebhook?: string;
    productionUrl?: string;
    stagingUrl?: string;
    visibility?: string;
    requireLeadApproval?: boolean;
    customLabels?: CustomLabelItem[];
  }
) {
  const tags: string[] = [];
  if (meta?.brief && meta.brief.trim()) {
    tags.push(`[brief:${meta.brief.trim()}]`);
  }
  if (meta?.gitRepo && meta.gitRepo.trim()) {
    tags.push(`[git:${meta.gitRepo.trim()}]`);
  }
  if (meta?.slackWebhook && meta.slackWebhook.trim()) {
    tags.push(`[slack:${meta.slackWebhook.trim()}]`);
  }
  if (meta?.discordWebhook && meta.discordWebhook.trim()) {
    tags.push(`[discord:${meta.discordWebhook.trim()}]`);
  }
  if (meta?.productionUrl && meta.productionUrl.trim()) {
    tags.push(`[prodUrl:${meta.productionUrl.trim()}]`);
  }
  if (meta?.stagingUrl && meta.stagingUrl.trim()) {
    tags.push(`[stagingUrl:${meta.stagingUrl.trim()}]`);
  }
  if (meta?.visibility && meta.visibility !== 'internal') {
    tags.push(`[vis:${meta.visibility}]`);
  }
  if (meta?.requireLeadApproval) {
    tags.push(`[leadApproval:true]`);
  }
  if (meta?.customLabels && meta.customLabels.length > 0) {
    tags.push(`[customLabels:${encodeURIComponent(JSON.stringify(meta.customLabels))}]`);
  }

  const prefix = tags.join(' ');
  const clean = cleanDesc.trim();
  return prefix ? `${prefix} ${clean}`.trim() : clean;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const ProjectSettingsView: React.FC = () => {
  const { id, section } = useParams<{ id: string; section?: string }>();
  const activeSection = section || 'overview';

  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();
  const { selectProject } = useNavigation();
  const { accentColor } = useAccentTheme();

  const projectId = id ? parseInt(id, 10) : 1;

  const [loading, setLoading] = useState(true);
  const [initialProject, setInitialProject] = useState<any>(null);

  // 1. Overview & General Form State
  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [briefDescription, setBriefDescription] = useState('');
  const [description, setDescription] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(PREDEFINED_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [priority, setPriority] = useState<string>('MEDIUM');

  // Appearance State
  const [avatarType, setAvatarType] = useState<'icon' | 'initials'>('icon');
  const [avatarId, setAvatarId] = useState<string>('folder');
  const [avatarColor, setAvatarColor] = useState<string>('#8B5CF6');
  const [showMoreIcons, setShowMoreIcons] = useState(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);

  // Team & Ownership State
  const [dbUsers, setDbUsers] = useState<WorkspaceUser[]>([]);
  const [dbTeams, setDbTeams] = useState<OrganizationTeam[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Timeline State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 2. Connected Accounts State
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [productionUrl, setProductionUrl] = useState('');
  const [stagingUrl, setStagingUrl] = useState('');
  const [isSyncingGit, setIsSyncingGit] = useState(false);

  // 3. Security & Access State
  const [visibility, setVisibility] = useState('internal');
  const [requireLeadApproval, setRequireLeadApproval] = useState(false);
  const [allowMemberCustomLabels, setAllowMemberCustomLabels] = useState(true);

  // 4. Labels & Categories State
  const [customLabels, setCustomLabels] = useState<CustomLabelItem[]>([
    { id: '1', name: 'bug', color: '#EF4444' },
    { id: '2', name: 'feature', color: '#10B981' },
    { id: '3', name: 'documentation', color: '#3B82F6' },
    { id: '4', name: 'refactor', color: '#8B5CF6' },
    { id: '5', name: 'performance', color: '#F59E0B' },
  ]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#8B5CF6');

  // Save / Discard / Delete State
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Close more icons and member dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (moreButtonRef.current && !moreButtonRef.current.contains(target)) {
        setShowMoreIcons(false);
      }
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(target)) {
        setIsMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Project & Workspace Resources
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [projRes, usersRes, teamsRes] = await Promise.all([
          organizationService.getProject(projectId),
          fetch(apiUrl('/users')).then((r) => r.json()).catch(() => ({ success: false })),
          currentOrganization?.slug
            ? organizationService.listTeams(currentOrganization.slug)
            : Promise.resolve({ success: false, data: [] }),
        ]);

        if (!isMounted) return;

        if (usersRes.success && Array.isArray(usersRes.data)) {
          setDbUsers(usersRes.data);
        }

        if (teamsRes.success && Array.isArray(teamsRes.data)) {
          setDbTeams(teamsRes.data);
        }

        if (projRes.success && projRes.data) {
          const p = projRes.data;
          setInitialProject(p);
          setTitle(p.title || '');
          setIdentifier(p.identifier || '');

          const parsedMeta = parseProjectMetadata(p.description);
          setBriefDescription(parsedMeta.brief || '');
          setDescription(parsedMeta.cleanDesc || '');
          setGitRepoUrl(parsedMeta.gitRepo || '');
          setSlackWebhook(parsedMeta.slackWebhook || '');
          setDiscordWebhook(parsedMeta.discordWebhook || '');
          setProductionUrl(parsedMeta.productionUrl || '');
          setStagingUrl(parsedMeta.stagingUrl || '');
          setVisibility(parsedMeta.visibility || 'internal');
          setRequireLeadApproval(parsedMeta.requireLeadApproval || false);
          setAllowMemberCustomLabels(parsedMeta.allowMemberCustomLabels ?? true);
          setCustomLabels(parsedMeta.customLabels || []);

          setStatus(p.status || 'IN_PROGRESS');
          setPriority(p.priority || 'MEDIUM');
          setAvatarColor(p.avatarColor || '#8B5CF6');

          if (p.avatarIcon) {
            setAvatarId(p.avatarIcon);
            setAvatarType('icon');
          } else {
            setAvatarType('initials');
          }

          if (p.category) {
            const cats = p.category.split(',').map((c: string) => c.trim()).filter(Boolean);
            setSelectedCategories(cats);
            setAvailableCategories((prev) => Array.from(new Set([...prev, ...cats])));
          } else {
            setSelectedCategories(['General']);
          }

          setSelectedLeadId(p.leadId || null);
          setSelectedTeamId(p.teamId || null);

          if (Array.isArray(p.members)) {
            const memberIds = p.members.map((m: any) => m.userId || m.user?.id).filter(Boolean);
            setSelectedMemberIds(memberIds);
          }

          if (p.startDate) {
            setStartDate(new Date(p.startDate).toISOString().split('T')[0]);
          } else {
            setStartDate('');
          }

          if (p.endDate) {
            setEndDate(new Date(p.endDate).toISOString().split('T')[0]);
          } else {
            setEndDate('');
          }
        }
      } catch (err) {
        console.error('Failed to load project settings:', err);
        toast.error('Failed to load project details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (projectId) {
      fetchData();
    }
  }, [projectId, currentOrganization?.slug]);

  // Derived initials
  const projectInitials = useMemo(() => {
    const clean = identifier || title || 'PR';
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [identifier, title]);

  // Check Dirty State across all tabs
  const isDirty = useMemo(() => {
    if (!initialProject) return false;
    const origCats = initialProject.category
      ? initialProject.category.split(',').map((c: string) => c.trim()).filter(Boolean)
      : ['General'];
    const sameCats =
      origCats.length === selectedCategories.length &&
      origCats.every((c: string) => selectedCategories.includes(c));

    const origMemberIds = Array.isArray(initialProject.members)
      ? initialProject.members.map((m: any) => m.userId || m.user?.id).filter(Boolean)
      : [];
    const sameMembers =
      origMemberIds.length === selectedMemberIds.length &&
      origMemberIds.every((id: number) => selectedMemberIds.includes(id));

    const origStart = initialProject.startDate
      ? new Date(initialProject.startDate).toISOString().split('T')[0]
      : '';
    const origEnd = initialProject.endDate
      ? new Date(initialProject.endDate).toISOString().split('T')[0]
      : '';

    const origMeta = parseProjectMetadata(initialProject.description);

    return (
      title !== (initialProject.title || '') ||
      identifier !== (initialProject.identifier || '') ||
      briefDescription !== (origMeta.brief || '') ||
      description !== (origMeta.cleanDesc || '') ||
      gitRepoUrl !== (origMeta.gitRepo || '') ||
      slackWebhook !== (origMeta.slackWebhook || '') ||
      discordWebhook !== (origMeta.discordWebhook || '') ||
      productionUrl !== (origMeta.productionUrl || '') ||
      stagingUrl !== (origMeta.stagingUrl || '') ||
      visibility !== (origMeta.visibility || 'internal') ||
      requireLeadApproval !== (origMeta.requireLeadApproval || false) ||
      status !== (initialProject.status || 'IN_PROGRESS') ||
      priority !== (initialProject.priority || 'MEDIUM') ||
      avatarColor !== (initialProject.avatarColor || '#8B5CF6') ||
      (avatarType === 'icon' ? avatarId : '') !== (initialProject.avatarIcon || '') ||
      selectedLeadId !== (initialProject.leadId || null) ||
      selectedTeamId !== (initialProject.teamId || null) ||
      !sameCats ||
      !sameMembers ||
      startDate !== origStart ||
      endDate !== origEnd ||
      JSON.stringify(customLabels) !== JSON.stringify(origMeta.customLabels)
    );
  }, [
    initialProject,
    title,
    identifier,
    briefDescription,
    description,
    gitRepoUrl,
    slackWebhook,
    discordWebhook,
    productionUrl,
    stagingUrl,
    visibility,
    requireLeadApproval,
    customLabels,
    status,
    priority,
    avatarColor,
    avatarType,
    avatarId,
    selectedLeadId,
    selectedTeamId,
    selectedCategories,
    selectedMemberIds,
    startDate,
    endDate,
  ]);

  // Reset Form
  const handleDiscardChanges = () => {
    if (!initialProject) return;
    setTitle(initialProject.title || '');
    setIdentifier(initialProject.identifier || '');
    const origMeta = parseProjectMetadata(initialProject.description);
    setBriefDescription(origMeta.brief || '');
    setDescription(origMeta.cleanDesc || '');
    setGitRepoUrl(origMeta.gitRepo || '');
    setSlackWebhook(origMeta.slackWebhook || '');
    setDiscordWebhook(origMeta.discordWebhook || '');
    setProductionUrl(origMeta.productionUrl || '');
    setStagingUrl(origMeta.stagingUrl || '');
    setVisibility(origMeta.visibility || 'internal');
    setRequireLeadApproval(origMeta.requireLeadApproval || false);
    setCustomLabels(origMeta.customLabels || []);

    setStatus(initialProject.status || 'IN_PROGRESS');
    setPriority(initialProject.priority || 'MEDIUM');
    setAvatarColor(initialProject.avatarColor || '#8B5CF6');

    if (initialProject.avatarIcon) {
      setAvatarId(initialProject.avatarIcon);
      setAvatarType('icon');
    } else {
      setAvatarType('initials');
    }

    if (initialProject.category) {
      setSelectedCategories(
        initialProject.category.split(',').map((c: string) => c.trim()).filter(Boolean)
      );
    } else {
      setSelectedCategories(['General']);
    }

    setSelectedLeadId(initialProject.leadId || null);
    setSelectedTeamId(initialProject.teamId || null);

    if (Array.isArray(initialProject.members)) {
      setSelectedMemberIds(
        initialProject.members.map((m: any) => m.userId || m.user?.id).filter(Boolean)
      );
    } else {
      setSelectedMemberIds([]);
    }

    if (initialProject.startDate) {
      setStartDate(new Date(initialProject.startDate).toISOString().split('T')[0]);
    } else {
      setStartDate('');
    }

    if (initialProject.endDate) {
      setEndDate(new Date(initialProject.endDate).toISOString().split('T')[0]);
    } else {
      setEndDate('');
    }

    toast.info('Changes discarded');
  };

  // Save Changes
  const handleSaveChanges = async () => {
    if (!title.trim()) {
      toast.error('Project title cannot be empty');
      return;
    }

    try {
      setIsSaving(true);
      const serializedDesc = serializeProjectDescription(description, {
        brief: briefDescription,
        gitRepo: gitRepoUrl,
        slackWebhook,
        discordWebhook,
        productionUrl,
        stagingUrl,
        visibility,
        requireLeadApproval,
        customLabels,
      });

      const payload: any = {
        title: title.trim(),
        identifier: identifier.trim().toUpperCase() || undefined,
        description: serializedDesc,
        category: selectedCategories.join(', '),
        status,
        priority,
        avatarColor,
        avatarIcon: avatarType === 'icon' ? avatarId : null,
        leadId: selectedLeadId,
        teamId: selectedTeamId,
        memberIds: selectedMemberIds,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      };

      const res = await organizationService.updateProject(projectId, payload);
      if (res.success && res.data) {
        setInitialProject(res.data);
        selectProject({
          id: res.data.id,
          title: res.data.title,
          key: res.data.identifier,
          identifier: res.data.identifier,
          status: res.data.status,
          avatarColor: res.data.avatarColor,
          avatarIcon: res.data.avatarIcon,
        });
        toast.success('Project settings saved successfully!');
      } else {
        toast.error((res as any).message || res.error || 'Failed to save project settings');
      }
    } catch (err: any) {
      console.error('Save project error:', err);
      toast.error(err.message || 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (deleteConfirmationPhrase.trim().toLowerCase() !== title.trim().toLowerCase()) {
      toast.error('Project title does not match confirmation phrase');
      return;
    }

    try {
      setIsDeleting(true);
      const res = await organizationService.deleteProject(projectId);
      if (res.success) {
        toast.success(`Project "${title}" has been permanently deleted`);
        setIsDeleteModalOpen(false);
        navigate(
          currentOrganization?.slug
            ? `/organizations/${currentOrganization.slug}/projects`
            : '/projects'
        );
      } else {
        toast.error((res as any).message || res.error || 'Failed to delete project');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred deleting project');
    } finally {
      setIsDeleting(false);
    }
  };

  // Label Management Helpers
  const handleAddCustomLabel = () => {
    if (!newLabelName.trim()) return;
    const exists = customLabels.some(
      (l) => l.name.toLowerCase() === newLabelName.trim().toLowerCase()
    );
    if (exists) {
      toast.info('Label already exists');
      return;
    }
    const newLabel: CustomLabelItem = {
      id: Date.now().toString(),
      name: newLabelName.trim().toLowerCase(),
      color: newLabelColor,
    };
    setCustomLabels((prev) => [...prev, newLabel]);
    setNewLabelName('');
  };

  const handleRemoveCustomLabel = (labelId: string) => {
    setCustomLabels((prev) => prev.filter((l) => l.id !== labelId));
  };

  // Category Management Helpers
  const handleAddCategory = () => {
    if (!newCategoryInput.trim()) return;
    const val = newCategoryInput.trim();
    if (!availableCategories.includes(val)) {
      setAvailableCategories((prev) => [...prev, val]);
    }
    if (!selectedCategories.includes(val)) {
      setSelectedCategories((prev) => [...prev, val]);
    }
    setNewCategoryInput('');
  };

  // Select Options formatting
  const leadOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        value: 'none',
        label: 'Unassigned (No Project Lead)',
        sublabel: 'Project is collectively led or self-organized',
      },
    ];

    dbUsers.forEach((u) => {
      list.push({
        value: u.id.toString(),
        label: u.name,
        sublabel: u.email,
        icon: (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: u.avatarColor || accentColor }}
          >
            {u.name.slice(0, 2).toUpperCase()}
          </div>
        ),
      });
    });
    return list;
  }, [dbUsers, accentColor]);

  const teamOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        value: 'none',
        label: 'None (Cross-team initiative)',
        sublabel: 'Not scoped to an individual engineering squad',
      },
    ];

    dbTeams.forEach((t) => {
      const { key, icon, cleanDesc } = parseTeamMetadata(t.description, t.name);
      const IconComponent = AVATAR_ICON_COMPONENTS[icon] || Users;
      const teamColor = t.color || '#6366F1';

      list.push({
        value: t.id.toString(),
        label: t.name,
        sublabel: cleanDesc ? `[${key}] ${cleanDesc}` : `Squad Key: ${key}`,
        icon: (
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
            style={{ backgroundColor: teamColor }}
          >
            <IconComponent size={12} strokeWidth={2.4} />
          </div>
        ),
      });
    });
    return list;
  }, [dbTeams]);

  const renderProjectIcon = (sizeClass = 'w-12 h-12', iconSize = 22) => {
    if (avatarType === 'icon') {
      const IconComp = AVATAR_ICON_COMPONENTS[avatarId] || FolderKanban;
      return (
        <div
          className={`${sizeClass} rounded-2xl flex items-center justify-center text-white shadow-xl transition-all duration-300 shrink-0`}
          style={{
            backgroundColor: avatarColor,
            boxShadow: `0 8px 24px ${avatarColor}40`,
          }}
        >
          <IconComp size={iconSize} strokeWidth={2.2} />
        </div>
      );
    }

    return (
      <div
        className={`${sizeClass} rounded-2xl flex items-center justify-center text-white font-mono font-bold text-base shadow-xl transition-all duration-300 shrink-0`}
        style={{
          backgroundColor: avatarColor,
          boxShadow: `0 8px 24px ${avatarColor}40`,
        }}
      >
        {projectInitials}
      </div>
    );
  };

  const filteredMemberUsers = useMemo(() => {
    if (!memberSearchQuery.trim()) return dbUsers;
    const q = memberSearchQuery.toLowerCase().trim();
    return dbUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q))
    );
  }, [dbUsers, memberSearchQuery]);

  const selectedMembers = useMemo(() => {
    return dbUsers.filter((u) => selectedMemberIds.includes(u.id));
  }, [dbUsers, selectedMemberIds]);

  const isCurrentMoreIcon =
    avatarType === 'icon' && MORE_AVATAR_ICONS.some((i) => i.id === avatarId);
  const CurrentMoreIconComponent =
    isCurrentMoreIcon && avatarId ? AVATAR_ICON_COMPONENTS[avatarId] : null;

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
        <span className="text-xs text-zinc-500 font-mono">Loading project settings...</span>
      </div>
    );
  }

  if (!initialProject) {
    return (
      <div className="p-8 text-center text-zinc-500 text-xs">
        <p className="text-sm font-semibold text-zinc-300 mb-2">Project not found</p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Projects</span>
        </Link>
      </div>
    );
  }

  return (
    <AccountSettingsLayout>
      {/* ─── TAB 1: OVERVIEW ──────────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <SettingsPageHeader
            title="Project Overview"
            description="Manage your project identity, brief description, timeline, and team assignments."
            profileSummary={{
              displayName: title || 'Untitled Project',
              email: briefDescription || 'No brief summary specified yet.',
              username: identifier ? `#${identifier}` : `#PROJECT`,
              avatarNode: renderProjectIcon('w-20 h-20 sm:w-24 sm:h-24', 36),
            }}
          />

          <div className="px-6 sm:px-8 space-y-2">
            {/* Project Identity */}
            <SettingsSection
              id="identity"
              title="Project Identity"
              description="Configure project title, key identifier, brief tagline, and architecture scope."
            >
              {/* Project Name */}
              <SettingsRow
                label="Project Name"
                description="The primary display title of your project."
              >
                <div className="space-y-1.5 max-w-md">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Core Engine v2"
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                    style={{ outlineColor: accentColor }}
                  />
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Must be descriptive and concise</span>
                    <span className="font-mono">{title.length}/60</span>
                  </div>
                </div>
              </SettingsRow>

              {/* Project Key / Identifier */}
              <SettingsRow
                label="Project Identifier"
                description="Unique uppercase key prefix used for task tracking (e.g., CORE-101)."
              >
                <div className="max-w-xs space-y-1">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-zinc-500">
                      #
                    </span>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) =>
                        setIdentifier(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9_-]/g, '')
                            .slice(0, 6)
                        )
                      }
                      placeholder="ENG"
                      maxLength={6}
                      className="w-full pl-8 pr-3.5 py-2 bg-[#111216] border border-[#27272A] rounded-xl text-xs font-mono font-bold uppercase text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors tracking-wider"
                    />
                  </div>
                </div>
              </SettingsRow>

              {/* Brief Description */}
              <SettingsRow
                label="Brief Description"
                description="A high-level one-line summary or tagline displayed on project badges and cards."
              >
                <div className="space-y-1.5 max-w-md">
                  <input
                    type="text"
                    value={briefDescription}
                    onChange={(e) => setBriefDescription(e.target.value)}
                    placeholder="e.g. Next-gen distributed real-time event pipeline"
                    maxLength={120}
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
                  />
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>Single-line tagline</span>
                    <span className="font-mono">{briefDescription.length}/120</span>
                  </div>
                </div>
              </SettingsRow>

              {/* Detailed Description */}
              <SettingsRow
                label="Detailed Scope & Notes"
                description="Architecture documentation, objectives, and release milestones."
              >
                <div className="space-y-1.5 max-w-lg">
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Document implementation goals, system boundaries, dependencies, and rollout plans..."
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors resize-y leading-relaxed"
                  />
                </div>
              </SettingsRow>

              {/* GitHub Integration */}
              <SettingsRow
                label="GitHub Repository"
                description="Link your project's GitHub repository to track branches, commits, pull requests, and issues."
              >
                <div className="w-full">
                  <ProjectGitHubLinker
                    projectId={projectId}
                    currentRepoUrl={gitRepoUrl}
                    onRepoLinked={(fullName) => setGitRepoUrl(fullName)}
                    onRepoUnlinked={() => setGitRepoUrl('')}
                  />
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Appearance & Avatar */}
            <SettingsSection
              id="appearance"
              title="Appearance & Avatar"
              description="Customize the visual badge, icon theme, and accent color palette."
            >
              {/* Avatar Type */}
              <SettingsRow
                label="Avatar Style"
                description="Display clean letter initials or a curated iconography glyph."
              >
                <div className="flex items-center gap-2 p-1 bg-[#111216] border border-[#27272A] rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setAvatarType('icon')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      avatarType === 'icon'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Icon Glyph
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarType('initials')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      avatarType === 'initials'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Letter Initials
                  </button>
                </div>
              </SettingsRow>

              {/* Avatar Color */}
              <SettingsRow
                label="Badge Color"
                description="Theme color applied to the project emblem, pills, and timeline."
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  {AVATAR_COLORS.map((c) => {
                    const isSelected = avatarColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAvatarColor(c.hex)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'scale-110 shadow-lg'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: c.hex,
                          boxShadow: isSelected
                            ? `0 0 0 2px #0C0D10, 0 0 0 4px ${c.hex}`
                            : undefined,
                        }}
                        title={c.name}
                      >
                        {isSelected && <Check size={12} className="text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </SettingsRow>

              {/* Icon Tray (when icon type selected) */}
              {avatarType === 'icon' && (
                <SettingsRow
                  label="Icon Glyph"
                  description="Choose from curated icons or explore the complete icon library."
                >
                  <div className="flex items-center gap-2 flex-wrap" ref={moreButtonRef}>
                    {/* Quick icons */}
                    {QUICK_AVATAR_ICONS.map((icon) => {
                      const isSelected = avatarType === 'icon' && avatarId === icon.id;
                      const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => {
                            setAvatarType('icon');
                            setAvatarId(icon.id);
                          }}
                          className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'shadow-md scale-105'
                              : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                          }`}
                          style={{
                            backgroundColor: isSelected ? avatarColor : '#0D0F14',
                            color: isSelected ? '#FFFFFF' : '#A1A1AA',
                            boxShadow: isSelected
                              ? `0 0 0 2px #0C0D10, 0 0 0 4px ${accentColor}`
                              : undefined,
                          }}
                          title={icon.name}
                        >
                          <IconComp size={14} strokeWidth={2.2} />
                          {isSelected && (
                            <div
                              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                              style={{ backgroundColor: accentColor }}
                            >
                              <Check size={8} strokeWidth={3} />
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* 3-Dot More Button */}
                    <button
                      type="button"
                      onClick={() => setShowMoreIcons((prev) => !prev)}
                      className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                        isCurrentMoreIcon
                          ? 'shadow-md scale-105'
                          : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: isCurrentMoreIcon ? avatarColor : '#0D0F14',
                        color: isCurrentMoreIcon ? '#FFFFFF' : undefined,
                        boxShadow: isCurrentMoreIcon
                          ? `0 0 0 2px #0C0D10, 0 0 0 4px ${accentColor}`
                          : undefined,
                      }}
                      title="More avatar icons"
                    >
                      {isCurrentMoreIcon && CurrentMoreIconComponent ? (
                        <CurrentMoreIconComponent size={14} strokeWidth={2.2} />
                      ) : (
                        <MoreHorizontal size={14} />
                      )}
                      {isCurrentMoreIcon && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white text-[7px] shadow"
                          style={{ backgroundColor: accentColor }}
                        >
                          <Check size={8} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* More Icons Popover */}
                  <AnimatePresence>
                    {showMoreIcons && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        className="mt-3 p-3 bg-[#111216] border border-[#27272A] rounded-2xl shadow-2xl max-w-xs z-50"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#27272A]">
                          <span className="text-[11px] font-semibold text-zinc-300">
                            More Project Glyphs
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMoreIcons(false)}
                            className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {MORE_AVATAR_ICONS.map((icon) => {
                            const IconComp = AVATAR_ICON_COMPONENTS[icon.id] || Smile;
                            const isSelected = avatarType === 'icon' && avatarId === icon.id;
                            return (
                              <button
                                key={icon.id}
                                type="button"
                                onClick={() => {
                                  setAvatarType('icon');
                                  setAvatarId(icon.id);
                                  setShowMoreIcons(false);
                                }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'shadow-md scale-105'
                                    : 'border border-white/[0.08] hover:scale-105 bg-[#0D0F14] text-zinc-400 hover:text-white'
                                }`}
                                style={{
                                  backgroundColor: isSelected ? avatarColor : '#0D0F14',
                                  color: isSelected ? '#FFFFFF' : undefined,
                                  boxShadow: isSelected
                                    ? `0 0 0 2px #0C0D10, 0 0 0 4px ${accentColor}`
                                    : undefined,
                                }}
                                title={icon.name}
                              >
                                <IconComp size={14} strokeWidth={2.2} />
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SettingsRow>
              )}
            </SettingsSection>

            {/* Timeline & Milestones */}
            <SettingsSection
              id="timeline"
              title="Timeline & Milestones"
              description="Define project schedule, start date, and target delivery completion date."
            >
              {/* Start Date */}
              <SettingsRow
                label="Start Date"
                description="When implementation work officially commences."
              >
                <div className="w-full max-w-sm">
                  <CustomDatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val || '')}
                    placeholder="Select planned start date"
                    dropUp={true}
                  />
                </div>
              </SettingsRow>

              {/* End Date */}
              <SettingsRow
                label="Target End Date"
                description="Projected delivery date or milestone release target."
              >
                <div className="w-full max-w-sm">
                  <CustomDatePicker
                    value={endDate}
                    onChange={(val) => setEndDate(val || '')}
                    placeholder="Select projected completion date"
                    dropUp={true}
                  />
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Team & Ownership */}
            <SettingsSection
              id="ownership"
              title="Team & Ownership"
              description="Assign project leadership, collaborating engineering squad, and individual contributors."
            >
              {/* Project Lead */}
              <SettingsRow
                label="Project Lead"
                description="The primary technical point of contact and decision maker for this project."
              >
                <div className="w-full max-w-md">
                  <AnimatedSelect
                    options={leadOptions}
                    value={selectedLeadId ? selectedLeadId.toString() : 'none'}
                    onChange={(val) =>
                      setSelectedLeadId(val === 'none' ? null : parseInt(val, 10))
                    }
                    placeholder="Select project lead..."
                  />
                </div>
              </SettingsRow>

              {/* Assigned Team */}
              <SettingsRow
                label="Engineering Squad"
                description="The dedicated team responsible for delivering this project's backlog."
              >
                <div className="w-full max-w-md">
                  <AnimatedSelect
                    options={teamOptions}
                    value={selectedTeamId ? selectedTeamId.toString() : 'none'}
                    onChange={(val) =>
                      setSelectedTeamId(val === 'none' ? null : parseInt(val, 10))
                    }
                    placeholder="Assign to squad..."
                  />
                </div>
              </SettingsRow>

              {/* Project Members Multi-Select */}
              <SettingsRow
                label="Assigned Members"
                description="Individual engineers and contributors granted direct task assignment access."
              >
                <div className="w-full max-w-md space-y-3" ref={memberDropdownRef}>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-left text-zinc-300 hover:border-zinc-500 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {selectedMembers.length === 0
                          ? 'Assign project members...'
                          : `${selectedMembers.length} member${
                              selectedMembers.length > 1 ? 's' : ''
                            } assigned`}
                      </span>
                      <Users size={14} className="text-zinc-500" />
                    </button>

                    {/* Member Dropdown Picker */}
                    <AnimatePresence>
                      {isMemberDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute left-0 right-0 top-full mt-2 p-3 bg-[#111216] border border-[#27272A] rounded-2xl shadow-2xl z-50 space-y-2"
                        >
                          <input
                            type="text"
                            value={memberSearchQuery}
                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                            placeholder="Filter members by name or email..."
                            className="w-full px-3 py-1.5 bg-[#0C0D10] border border-[#27272A] rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {filteredMemberUsers.map((u) => {
                              const isChecked = selectedMemberIds.includes(u.id);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedMemberIds((prev) =>
                                      isChecked
                                        ? prev.filter((id) => id !== u.id)
                                        : [...prev, u.id]
                                    );
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-zinc-800 text-xs text-left transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <div
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                      style={{ backgroundColor: u.avatarColor || accentColor }}
                                    >
                                      {u.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="truncate">
                                      <p className="font-medium text-white truncate">{u.name}</p>
                                      <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                                    </div>
                                  </div>
                                  {isChecked && (
                                    <Check
                                      size={14}
                                      className="text-white shrink-0"
                                      style={{ color: accentColor }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Members Chips */}
                  {selectedMembers.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedMembers.map((m) => (
                        <div
                          key={m.id}
                          className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
                        >
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                            style={{ backgroundColor: m.avatarColor || accentColor }}
                          >
                            {m.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span>{m.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMemberIds((prev) => prev.filter((id) => id !== m.id))
                            }
                            className="text-zinc-500 hover:text-white transition-colors cursor-pointer ml-0.5"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      )}

      {/* ─── TAB: PROJECT STRUCTURE ────────────────────────────────────────── */}
      {activeSection === 'structure' && (
        <ProjectStructureView projectId={projectId} />
      )}

      {/* ─── TAB: SIDEBAR ORDER & VIRTUAL PREVIEW ─────────────────────────── */}
      {activeSection === 'sidebar' && (
        <SidebarOrderSettingsView projectId={projectId} />
      )}

      {/* ─── TAB 2: CONNECTED ACCOUNTS ────────────────────────────────────── */}
      {activeSection === 'connections' && (
        <div className="space-y-6">
          <SettingsPageHeader
            title="Connected Accounts & Integrations"
            description="Link external code repositories, issue trackers, and webhook notification channels."
          />

          <div className="px-6 sm:px-8 space-y-2">
            {/* Source Code Repositories */}
            <SettingsSection
              id="repositories"
              title="Source Code Repositories"
              description="Connect Git repositories to sync commits, pull requests, and branch builds to project tasks."
            >
              {/* GitHub */}
              <SettingsRow
                label="GitHub Repository"
                description="Link your GitHub account to sync branches, commits, pull requests, and issues."
              >
                <div className="w-full">
                  <ProjectGitHubLinker
                    projectId={projectId}
                    currentRepoUrl={gitRepoUrl}
                    onRepoLinked={(fullName) => setGitRepoUrl(fullName)}
                    onRepoUnlinked={() => setGitRepoUrl('')}
                  />
                </div>
              </SettingsRow>

              {/* GitLab */}
              <SettingsRow
                label="GitLab Project"
                description="Support for self-hosted GitLab CE/EE or GitLab.com namespaces."
              >
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                    GitLab API v4
                  </span>
                  <button
                    type="button"
                    onClick={() => toast.info('GitLab OAuth connector ready')}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors cursor-pointer"
                  >
                    Connect GitLab
                  </button>
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Notification Webhooks */}
            <SettingsSection
              id="notifications"
              title="Notification Webhooks"
              description="Broadcast project milestone alerts and status transitions to your chat channels."
            >
              {/* Slack */}
              <SettingsRow
                label="Slack Webhook"
                description="Post task updates and sprint milestones to a dedicated Slack channel."
              >
                <div className="space-y-1.5 max-w-md">
                  <input
                    type="url"
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-zinc-500">
                    Incoming Webhooks integration URL from Slack App Directory
                  </span>
                </div>
              </SettingsRow>

              {/* Discord */}
              <SettingsRow
                label="Discord Webhook"
                description="Send automated deploy announcements to Discord text channels."
              >
                <div className="space-y-1.5 max-w-md">
                  <input
                    type="url"
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors font-mono"
                  />
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Environments & Deployments */}
            <SettingsSection
              id="environments"
              title="Environments & Deployments"
              description="Quick-access links to staging environments, production clusters, and API documentation."
            >
              {/* Production URL */}
              <SettingsRow
                label="Production Environment"
                description="Live customer-facing URL for this project."
              >
                <div className="max-w-md">
                  <input
                    type="url"
                    value={productionUrl}
                    onChange={(e) => setProductionUrl(e.target.value)}
                    placeholder="https://app.example.com"
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              </SettingsRow>

              {/* Staging URL */}
              <SettingsRow
                label="Staging Environment"
                description="Pre-production test sandbox for QA and client sign-off."
              >
                <div className="max-w-md">
                  <input
                    type="url"
                    value={stagingUrl}
                    onChange={(e) => setStagingUrl(e.target.value)}
                    placeholder="https://staging.example.com"
                    className="w-full px-3.5 py-2.5 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      )}

      {/* ─── TAB: GIT MEMBER MAPPING ─────────────────────────────────────── */}
      {activeSection === 'git-members' && (
        <div className="px-6 sm:px-8 py-6">
          <ProjectGitMemberMapping projectId={projectId} />
        </div>
      )}

      {/* ─── TAB: STORAGE (REPO, BRANCH USAGE, UNLINK & RELINK) ─────────── */}
      {activeSection === 'storage' && (
        <ProjectStorageSettingsTab projectId={projectId} />
      )}

      {/* ─── TAB 3: SECURITY & ACCESS ─────────────────────────────────────── */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          <SettingsPageHeader
            title="Security & Access"
            description="Manage project visibility, collaborator permissions, and irreversible administrative operations."
          />

          <div className="px-6 sm:px-8 space-y-2">
            {/* Project Visibility */}
            <SettingsSection
              id="visibility"
              title="Project Visibility"
              description="Determine who in your workspace can view, track, or contribute to this project."
            >
              <SettingsRow
                label="Access Level"
                description="Control visibility across organizational teams."
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                  {[
                    {
                      id: 'public',
                      title: 'Public',
                      desc: 'All workspace members can view and create tasks.',
                      icon: Globe,
                    },
                    {
                      id: 'internal',
                      title: 'Internal',
                      desc: 'Visible to organization; changes restricted to assigned team.',
                      icon: Unlock,
                    },
                    {
                      id: 'private',
                      title: 'Restricted',
                      desc: 'Strictly restricted to assigned project members and lead.',
                      icon: Lock,
                    },
                  ].map((v) => {
                    const isSelected = visibility === v.id;
                    const Icon = v.icon;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVisibility(v.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800/80 border-zinc-600 shadow-lg'
                            : 'bg-[#111216] border-[#27272A] hover:border-zinc-600'
                        }`}
                        style={{
                          borderColor: isSelected ? accentColor : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon
                            size={16}
                            style={{ color: isSelected ? accentColor : '#A1A1AA' }}
                          />
                          <span className="text-xs font-bold text-white">{v.title}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{v.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Access Policies */}
            <SettingsSection
              id="policies"
              title="Governance & Policies"
              description="Configure project-level review gates and contribution guardrails."
            >
              {/* Lead signoff */}
              <SettingsRow
                label="Project Lead Sign-off"
                description="Require Project Lead approval before closing milestones or archiving tasks."
              >
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireLeadApproval}
                    onChange={(e) => setRequireLeadApproval(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </SettingsRow>

              {/* Custom labels permission */}
              <SettingsRow
                label="Member Label Creation"
                description="Allow any assigned collaborator to create new custom task labels."
              >
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMemberCustomLabels}
                    onChange={(e) => setAllowMemberCustomLabels(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </SettingsRow>
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection
              id="danger"
              title="Danger Zone"
              description="Irreversible actions regarding project lifecycle and permanent deletion."
            >
              {/* Archive */}
              <SettingsRow
                label="Archive Project"
                description="Mark project as read-only. Tasks and documents are preserved but removed from active boards."
              >
                <button
                  type="button"
                  onClick={() => toast.info('Project archive status toggled')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  Archive Project
                </button>
              </SettingsRow>

              {/* Delete Project */}
              <SettingsRow
                label="Delete Project"
                description="Permanently delete this project along with all associated tasks, comments, and milestones."
              >
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Delete Project...</span>
                </button>
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      )}

      {/* ─── TAB 4: LABELS & CATEGORIES ──────────────────────────────────── */}
      {activeSection === 'labels' && (
        <div className="space-y-6">
          <SettingsPageHeader
            title="Labels & Categories"
            description="Classify your project with taxonomy categories and manage custom issue label badges."
          />

          <div className="px-6 sm:px-8 space-y-2">
            {/* Project Categories */}
            <SettingsSection
              id="categories"
              title="Project Categories"
              description="Assign one or more functional tags to organize your organization portfolio."
            >
              <SettingsRow
                label="Selected Categories"
                description="Multi-select taxonomy tags applied to this project."
              >
                <div className="space-y-3 max-w-md">
                  <AnimatedMultiSelect
                    options={availableCategories.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                    values={selectedCategories}
                    onChange={setSelectedCategories}
                    placeholder="Select project categories..."
                    allowCustom={true}
                    onAddCustom={(newCat) => {
                      if (!availableCategories.includes(newCat)) {
                        setAvailableCategories((prev) => [...prev, newCat]);
                      }
                      if (!selectedCategories.includes(newCat)) {
                        setSelectedCategories((prev) => [...prev, newCat]);
                      }
                    }}
                  />
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Custom Issue Labels */}
            <SettingsSection
              id="labels"
              title="Task & Issue Label Badges"
              description="Manage colorful tags available for issues in this project."
            >
              {/* Add New Label */}
              <SettingsRow
                label="Create Label"
                description="Define custom badge name and pick a vibrant indicator color."
              >
                <div className="space-y-3 max-w-md">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="e.g., hotfix, tech-debt..."
                      className="flex-1 px-3.5 py-2 bg-[#111216] border border-[#27272A] rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomLabel}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span>Add Label</span>
                    </button>
                  </div>

                  {/* Color Swatch Picker */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400">Color:</span>
                    {LABEL_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setNewLabelColor(hex)}
                        className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                          newLabelColor === hex ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#0C0D10]' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              </SettingsRow>

              {/* Active Labels List */}
              <SettingsRow
                label="Project Labels"
                description="All currently registered badges for issue classification."
              >
                <div className="flex items-center gap-2 flex-wrap max-w-lg">
                  {customLabels.map((lbl) => (
                    <span
                      key={lbl.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm"
                      style={{
                        backgroundColor: `${lbl.color}15`,
                        borderColor: `${lbl.color}35`,
                        color: lbl.color,
                      }}
                    >
                      <Tag size={11} />
                      <span>{lbl.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomLabel(lbl.id)}
                        className="opacity-70 hover:opacity-100 hover:text-white transition-opacity cursor-pointer ml-1"
                        title="Remove label"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      )}

      {/* ─── TAB 5: STATUS & WORKFLOW ─────────────────────────────────────── */}
      {activeSection === 'status' && (
        <div className="space-y-6">
          <SettingsPageHeader
            title="Status & Workflow"
            description="Configure project lifecycle phases, default task priorities, and milestone transition rules."
          />

          <div className="px-6 sm:px-8 space-y-2">
            {/* Project Status Lifecycle */}
            <SettingsSection
              id="lifecycle"
              title="Project Lifecycle Status"
              description="The current operational phase of this project in your development pipeline."
            >
              <SettingsRow
                label="Current Stage"
                description="Select project status to reflect progress across dashboards and roadmap views."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
                  {STATUS_OPTIONS.map((st) => {
                    const isSelected = status === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setStatus(st.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-800/80 border-zinc-500 shadow-lg'
                            : 'bg-[#111216] border-[#27272A] hover:border-zinc-700'
                        }`}
                        style={{
                          borderColor: isSelected ? st.color : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${st.color}18`,
                              color: st.color,
                            }}
                          >
                            {st.label}
                          </span>
                          {isSelected && (
                            <Check size={14} style={{ color: st.color }} strokeWidth={3} />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{st.description}</p>
                      </button>
                    );
                  })}
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Default Priority */}
            <SettingsSection
              id="priority"
              title="Default Priority"
              description="Initial urgency level assigned to newly created tasks in this project."
            >
              <SettingsRow
                label="Task Priority"
                description="Baseline priority for automated issue triage."
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  {PRIORITY_OPTIONS.map((p) => {
                    const isSelected = priority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-zinc-800 text-white shadow-md'
                            : 'bg-[#111216] border-[#27272A] text-zinc-400 hover:text-white'
                        }`}
                        style={{
                          borderColor: isSelected ? p.color : undefined,
                          color: isSelected ? p.color : undefined,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </SettingsRow>
            </SettingsSection>
          </div>
        </div>
      )}

      {/* ─── FLOATING DIRTY-STATE SAVE BAR ────────────────────────────────── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-6 right-6 sm:right-10 z-50 flex items-center gap-3 px-4 py-3 bg-[#111216]/95 border border-[#27272A] rounded-2xl shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-xs font-medium text-zinc-300">
                Unsaved changes in project settings
              </span>
            </div>

            <div className="h-4 w-[1px] bg-zinc-800" />

            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Discard
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 4px 14px ${accentColor}40`,
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 bg-[#111216] border border-red-500/30 rounded-3xl shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Project</h3>
                  <p className="text-xs text-zinc-400">This action is permanent and cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Please type <span className="font-mono font-bold text-white bg-zinc-800 px-1.5 py-0.5 rounded">{title}</span> to confirm deletion:
              </p>

              <input
                type="text"
                value={deleteConfirmationPhrase}
                onChange={(e) => setDeleteConfirmationPhrase(e.target.value)}
                placeholder="Type project title to confirm"
                className="w-full px-3.5 py-2.5 bg-[#0C0D10] border border-red-500/30 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500 font-mono"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmationPhrase('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={
                    isDeleting ||
                    deleteConfirmationPhrase.trim().toLowerCase() !== title.trim().toLowerCase()
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete Forever</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AccountSettingsLayout>
  );
};
