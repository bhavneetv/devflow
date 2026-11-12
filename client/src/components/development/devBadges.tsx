import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bug,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  FileText,
  FlaskConical,
  Layers,
  Minus,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import type {
  DevAssigneeGroups,
  DevMasterChoiceItem,
  DevTaskPriority,
  DevTeamOption,
  DevUser,
} from '../../types/development';
import { getMasterIconComponent } from './devIcons';

export const PRIORITY_STYLES: Record<
  DevTaskPriority,
  { color: string; bg: string; border: string; icon: React.ComponentType<any> }
> = {
  Critical: {
    color: '#F87171',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.35)',
    icon: AlertOctagon,
  },
  High: {
    color: '#FB923C',
    bg: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.35)',
    icon: ArrowUp,
  },
  Medium: {
    color: '#FBBF24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.35)',
    icon: Minus,
  },
  Low: {
    color: '#60A5FA',
    bg: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.35)',
    icon: ArrowDown,
  },
};

export function getStatusStyle(status: string): {
  color: string;
  bg: string;
  border: string;
  icon: React.ComponentType<any>;
} {
  const lower = status.trim().toLowerCase();
  if (lower === 'completed' || lower === 'done') {
    return {
      color: '#34D399',
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.35)',
      icon: CheckCircle2,
    };
  }
  if (lower === 'in progress') {
    return {
      color: '#60A5FA',
      bg: 'rgba(59, 130, 246, 0.14)',
      border: 'rgba(59, 130, 246, 0.35)',
      icon: Zap,
    };
  }
  if (lower === 'in review') {
    return {
      color: '#A78BFA',
      bg: 'rgba(139, 92, 246, 0.14)',
      border: 'rgba(139, 92, 246, 0.35)',
      icon: Clock,
    };
  }
  if (lower === 'blocked') {
    return {
      color: '#F87171',
      bg: 'rgba(239, 68, 68, 0.14)',
      border: 'rgba(239, 68, 68, 0.35)',
      icon: AlertTriangle,
    };
  }
  return {
    color: '#A1A1AA',
    bg: 'rgba(113, 113, 122, 0.14)',
    border: 'rgba(113, 113, 122, 0.32)',
    icon: Circle,
  };
}

export function isEndStatusName(
  status: string,
  statusItems?: DevMasterChoiceItem[]
): boolean {
  const lower = status.trim().toLowerCase();
  if (lower === 'completed') return true;
  if (!statusItems || statusItems.length === 0) return false;
  return statusItems.some((s) => s.name.trim().toLowerCase() === lower && Boolean(s.isEnd));
}

export function isDevelopmentTaskType(taskType?: string | null): boolean {
  return (taskType || '').trim().toLowerCase() === 'development';
}

export function getTaskTypeStyle(taskType: string): {
  color: string;
  bg: string;
  border: string;
  icon: React.ComponentType<any>;
} {
  const lower = taskType.trim().toLowerCase();
  if (lower === 'development' || lower === 'dev') {
    return {
      color: '#34D399',
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.34)',
      icon: Code2,
    };
  }
  if (lower === 'research') {
    return {
      color: '#38BDF8',
      bg: 'rgba(56, 189, 248, 0.14)',
      border: 'rgba(56, 189, 248, 0.34)',
      icon: FlaskConical,
    };
  }
  if (lower === 'documentation' || lower === 'docs') {
    return {
      color: '#F472B6',
      bg: 'rgba(244, 114, 182, 0.12)',
      border: 'rgba(244, 114, 182, 0.3)',
      icon: FileText,
    };
  }
  if (lower === 'testing' || lower === 'qa') {
    return {
      color: '#A78BFA',
      bg: 'rgba(167, 139, 250, 0.12)',
      border: 'rgba(167, 139, 250, 0.3)',
      icon: CheckCircle2,
    };
  }
  if (lower === 'bug') {
    return {
      color: '#FCA5A5',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.28)',
      icon: Bug,
    };
  }
  if (lower === 'feature') {
    return {
      color: '#6EE7B7',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.28)',
      icon: Sparkles,
    };
  }
  if (lower === 'improvement') {
    return {
      color: '#93C5FD',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.28)',
      icon: Zap,
    };
  }
  if (lower.includes('debt')) {
    return {
      color: '#FCD34D',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.28)',
      icon: Wrench,
    };
  }
  return {
    color: '#C4B5FD',
    bg: 'rgba(139, 92, 246, 0.12)',
    border: 'rgba(139, 92, 246, 0.28)',
    icon: Layers,
  };
}

export function formatDevDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatEffort(value?: number | null, unit?: string): string {
  if (value === null || value === undefined) return '—';
  return unit === 'story_points' ? `${value} pts` : `${value}h`;
}

export const PriorityBadge: React.FC<{
  priority: DevTaskPriority;
  compact?: boolean;
  customItem?: DevMasterChoiceItem;
}> = ({
  priority,
  compact,
  customItem,
}) => {
  const baseStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Medium;
  const style = customItem
    ? {
        color: customItem.color || baseStyle.color,
        bg: `${customItem.color || '#F59E0B'}22`,
        border: `${customItem.color || '#F59E0B'}55`,
        icon: getMasterIconComponent(customItem.icon, baseStyle.icon),
      }
    : baseStyle;
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        padding: compact ? '2px 6px' : '2px 8px',
        fontSize: compact ? '10px' : '11px',
      }}
    >
      <Icon size={compact ? 10 : 11} />
      <span>{priority}</span>
    </span>
  );
};

export const StatusBadge: React.FC<{
  status: string;
  compact?: boolean;
  customItem?: DevMasterChoiceItem;
}> = ({ status, compact, customItem }) => {
  const baseStyle = getStatusStyle(status);
  const style = customItem
    ? {
        color: customItem.color || baseStyle.color,
        bg: `${customItem.color || '#71717A'}22`,
        border: `${customItem.color || '#71717A'}55`,
        icon: getMasterIconComponent(customItem.icon, baseStyle.icon),
      }
    : baseStyle;
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        padding: compact ? '2px 6px' : '2px 8px',
        fontSize: compact ? '10px' : '11px',
      }}
    >
      <Icon size={compact ? 10 : 11} />
      <span>{status}</span>
    </span>
  );
};

export const TaskTypeBadge: React.FC<{ taskType: string; compact?: boolean }> = ({
  taskType,
  compact,
}) => {
  const style = getTaskTypeStyle(taskType);
  const Icon = style.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap"
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        padding: compact ? '2px 6px' : '2px 8px',
        fontSize: compact ? '10px' : '11px',
      }}
    >
      <Icon size={compact ? 10 : 11} />
      <span>{taskType}</span>
    </span>
  );
};

export function getMatchedTeams(
  users: DevUser[],
  assigneeGroups?: DevAssigneeGroups
) {
  if (!users || users.length === 0 || !assigneeGroups) return [];
  const assigneeIds = new Set(users.map((u) => u.id));
  const unique = new Map<number, NonNullable<DevAssigneeGroups['teams']>[number]>();
  [...(assigneeGroups.teams || []), ...(assigneeGroups.allTeams || [])].forEach((team) => {
    if (!unique.has(team.id)) {
      unique.set(team.id, team);
    }
  });
  return Array.from(unique.values()).filter(
    (team) => team.memberIds.length > 0 && team.memberIds.every((id) => assigneeIds.has(id))
  );
}

export const DevAvatarStack: React.FC<{
  users: DevUser[];
  assignedTeams?: DevTeamOption[];
  assigneeGroups?: DevAssigneeGroups;
  max?: number;
  size?: 'xs' | 'sm';
}> = ({ users, assignedTeams, max = 3, size = 'xs' }) => {
  const teams = assignedTeams || [];
  const members = users || [];

  if (teams.length === 0 && members.length === 0) {
    return <span className="text-[11px] text-zinc-500 italic">Unassigned</span>;
  }

  type StackEntry =
    | { kind: 'team'; team: DevTeamOption }
    | { kind: 'user'; user: DevUser };

  const orderedEntries: StackEntry[] = [
    ...teams.map((team) => ({ kind: 'team' as const, team })),
    ...members.map((user) => ({ kind: 'user' as const, user })),
  ];

  const cap = Math.max(max, teams.length > 0 ? max + Math.min(2, teams.length) : max);
  const visibleEntries = orderedEntries.slice(0, cap);
  const overflow = orderedEntries.length - visibleEntries.length;
  const dim = size === 'xs' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]';

  return (
    <div className="flex items-center -space-x-1.5">
      {visibleEntries.map((entry) => {
        if (entry.kind === 'team') {
          const team = entry.team;
          const TeamIcon = getMasterIconComponent(team.icon, Users);
          const color = team.color || '#6366F1';
          const count = team.memberCount ?? team.memberIds?.length ?? 0;
          return (
            <div
              key={`team-${team.id}`}
              title={`${team.name} (${count} ${count === 1 ? 'member' : 'members'})`}
              className={`${dim} rounded-full border border-[#0E0F14] flex items-center justify-center shrink-0 shadow-sm bg-[#161923]`}
              style={{
                backgroundColor: `${color}28`,
                color,
              }}
            >
              <TeamIcon size={size === 'xs' ? 11 : 13} />
            </div>
          );
        }

        const u = entry.user;
        const initials = (u.name || 'U')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('');
        return (
          <div
            key={`user-${u.id}`}
            title={u.name}
            className={`${dim} rounded-full border border-[#0E0F14] flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden shadow-sm`}
            style={{ backgroundColor: u.avatarColor || '#6366F1' }}
          >
            {u.avatarUrl ? (
              <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className={`${dim} rounded-full border border-[#0E0F14] bg-[#1C1E26] text-zinc-300 flex items-center justify-center font-mono font-medium shrink-0`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

