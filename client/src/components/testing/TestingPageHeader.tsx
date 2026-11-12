import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart2,
  Bug,
  CheckSquare,
  ClipboardList,
  Layers,
  PieChart,
  PlayCircle,
  Sliders,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

export function useTestingNavigation(projectId: number) {
  const navigate = useNavigate();
  const { organizationSlug } = useParams<{ organizationSlug?: string }>();

  const projectBase = organizationSlug
    ? `/organizations/${organizationSlug}/projects/${projectId}`
    : `/projects/${projectId}`;

  const buildSubmoduleUrl = (subpath: string, query?: Record<string, string | number | undefined | null>) => {
    const clean = subpath.replace(/^\/+/, '');
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') {
          params.set(k, String(v));
        }
      });
    }
    const qs = params.toString();
    return `${projectBase}/${clean}${qs ? `?${qs}` : ''}`;
  };

  const goToSubmodule = (subpath: string, query?: Record<string, string | number | undefined | null>) => {
    navigate(buildSubmoduleUrl(subpath, query));
  };

  return { projectBase, buildSubmoduleUrl, goToSubmodule };
}

export const TESTING_SUBMODULE_NAV = [
  { key: 'testing-overview', label: 'Overview', icon: BarChart2 },
  { key: 'test-cases', label: 'Test Cases', icon: CheckSquare },
  { key: 'test-suites', label: 'Test Suites', icon: Layers },
  { key: 'test-plans', label: 'Test Plans', icon: ClipboardList },
  { key: 'test-runs', label: 'Test Runs', icon: PlayCircle },
  { key: 'defects', label: 'Defects', icon: Bug },
  { key: 'test-reports', label: 'Reports', icon: PieChart },
  { key: 'testing-settings', label: 'Settings', icon: Sliders },
] as const;

interface TestingPageHeaderProps {
  projectId: number;
  activeKey: string;
  title: string;
  description?: string;
  badge?: string | number;
  icon?: React.ComponentType<any>;
  actions?: React.ReactNode;
}

export const TestingPageHeader: React.FC<TestingPageHeaderProps> = ({
  projectId,
  activeKey,
  title,
  description,
  badge,
  icon: Icon = CheckSquare,
  actions,
}) => {
  const { accentColor } = useAccentTheme();
  const { goToSubmodule } = useTestingNavigation(projectId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
                Testing &amp; QA
              </span>
              {badge !== undefined && badge !== null && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-gray-300 border border-white/10">
                  {badge}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              {title}
            </h1>
            {description && (
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5 max-w-2xl">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
      </div>

      {/* Compact submodule breadcrumb strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {TESTING_SUBMODULE_NAV.map((item) => {
          const NavIcon = item.icon;
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => goToSubmodule(item.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                isActive
                  ? 'text-white border-white/20 bg-white/[0.09] shadow-sm'
                  : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.04]'
              )}
              style={
                isActive
                  ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}18` }
                  : undefined
              }
            >
              <NavIcon className="w-3.5 h-3.5" style={isActive ? { color: accentColor } : undefined} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
