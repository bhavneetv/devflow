import React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Box,
  Bug,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Cpu,
  Database,
  Eye,
  FileText,
  Flag,
  Flame,
  Folder,
  Globe,
  Layers,
  Lock,
  Minus,
  Rocket,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface DevIconDefinition {
  name: string;
  label: string;
  Icon: LucideIcon;
}

export const DEV_MASTER_ICONS: DevIconDefinition[] = [
  { name: 'Layers', label: 'Layers', Icon: Layers },
  { name: 'Box', label: 'Module Box', Icon: Box },
  { name: 'Folder', label: 'Folder', Icon: Folder },
  { name: 'Code2', label: 'Code', Icon: Code2 },
  { name: 'Server', label: 'Server', Icon: Server },
  { name: 'Database', label: 'Database', Icon: Database },
  { name: 'Globe', label: 'Web / API', Icon: Globe },
  { name: 'Smartphone', label: 'Mobile', Icon: Smartphone },
  { name: 'Cpu', label: 'Core / Engine', Icon: Cpu },
  { name: 'Shield', label: 'Security', Icon: Shield },
  { name: 'Lock', label: 'Auth', Icon: Lock },
  { name: 'Rocket', label: 'Release', Icon: Rocket },
  { name: 'Sparkles', label: 'Feature', Icon: Sparkles },
  { name: 'Bug', label: 'Bug', Icon: Bug },
  { name: 'Wrench', label: 'Maintenance', Icon: Wrench },
  { name: 'Flame', label: 'Critical', Icon: Flame },
  { name: 'ArrowUp', label: 'High', Icon: ArrowUp },
  { name: 'Minus', label: 'Medium', Icon: Minus },
  { name: 'ArrowDown', label: 'Low', Icon: ArrowDown },
  { name: 'Flag', label: 'Flag', Icon: Flag },
  { name: 'Circle', label: 'Not Started', Icon: Circle },
  { name: 'Clock', label: 'Pending', Icon: Clock },
  { name: 'Zap', label: 'In Progress', Icon: Zap },
  { name: 'Eye', label: 'In Review', Icon: Eye },
  { name: 'AlertTriangle', label: 'Blocked', Icon: AlertTriangle },
  { name: 'CheckCircle2', label: 'Completed', Icon: CheckCircle2 },
  { name: 'FileText', label: 'Docs', Icon: FileText },
  { name: 'Users', label: 'Team', Icon: Users },
];

const ICON_MAP: Record<string, React.ComponentType<any>> = Object.fromEntries(
  DEV_MASTER_ICONS.map((entry) => [entry.name.toLowerCase(), entry.Icon])
);

export function getMasterIconComponent(
  iconName?: string | null,
  fallback: React.ComponentType<any> = Circle
): React.ComponentType<any> {
  if (!iconName) return fallback;
  return ICON_MAP[iconName.trim().toLowerCase()] || fallback;
}

export function MasterIconBadge({
  icon,
  color = '#10B981',
  size = 13,
  className = '',
}: {
  icon?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const IconComp = getMasterIconComponent(icon, Layers);
  const safeColor = color || '#10B981';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border shrink-0 ${className}`}
      style={{
        width: size + 9,
        height: size + 9,
        backgroundColor: `${safeColor}1A`,
        borderColor: `${safeColor}45`,
        color: safeColor,
      }}
    >
      <IconComp style={{ width: size, height: size }} />
    </span>
  );
}

export const DEV_MASTER_COLORS = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#6366F1',
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
  '#71717A',
];
