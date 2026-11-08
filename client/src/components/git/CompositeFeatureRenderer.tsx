import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Layers,
  Settings,
  LayoutDashboard,
  GitFork,
  CircleDot,
  GitPullRequest,
  Columns,
  List,
} from 'lucide-react';
import type { ProjectSubmodule } from '../../types/module';
import type { CompositeSubmoduleConfig, GitFeatureKey } from '../../types/git';
import { GIT_FEATURES_REGISTRY, GIT_SUMMARY_CARD_DEFINITIONS } from '../../types/git';
import { GitFeatureRenderer } from './GitFeatureRenderer';
import { GitSummaryCard } from './GitSummaryCard';
import { resolveModuleIcon } from '../project/ModuleIconPicker';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { cn } from '../../lib/utils';

export interface CompositeFeatureRendererProps {
  projectId: number;
  submodule: ProjectSubmodule;
}

export const CompositeFeatureRenderer: React.FC<CompositeFeatureRendererProps> = ({
  projectId,
  submodule,
}) => {
  const { accentColor } = useAccentTheme();
  const { activeProject } = useNavigation();

  // Parse config
  const config: CompositeSubmoduleConfig = useMemo(() => {
    if (!submodule.config) {
      return {
        features: ['git.overview', 'git.merge_requests'],
        layout: 'tabs',
        defaultTab: 'git.overview',
      };
    }
    try {
      const parsed = JSON.parse(submodule.config);
      return {
        features: Array.isArray(parsed.features) && parsed.features.length > 0
          ? parsed.features
          : ['git.overview', 'git.merge_requests'],
        summaryCards: Array.isArray(parsed.summaryCards) ? parsed.summaryCards : undefined,
        layout: parsed.layout || 'tabs',
        defaultTab: parsed.defaultTab || parsed.features?.[0] || 'git.overview',
        defaultRepoFilter: parsed.defaultRepoFilter,
      };
    } catch {
      return {
        features: ['git.overview', 'git.merge_requests'],
        layout: 'tabs',
        defaultTab: 'git.overview',
      };
    }
  }, [submodule.config]);

  const [activeTab, setActiveTab] = useState<string>(config.defaultTab || config.features[0] || 'git.overview');
  const [activeFilter, setActiveFilter] = useState<Record<string, any>>({});

  const SubIcon = resolveModuleIcon(submodule.icon, Boxes);

  const getFeatureMeta = (key: string) => {
    return GIT_FEATURES_REGISTRY.find((f) => f.key === key) || {
      key,
      title: key,
      description: '',
      icon: 'boxes',
    };
  };

  const handleNavigateToFeature = (featureKey: string, filter?: Record<string, any>) => {
    setActiveTab(featureKey);
    if (filter) setActiveFilter(filter);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <Link to={`/projects/${projectId}`} className="hover:text-white transition-colors">
            {activeProject?.title || 'Project'}
          </Link>
          <span>/</span>
          <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
            <SubIcon size={13} style={{ color: accentColor }} />
            <span>{submodule.name}</span>
          </span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Composite Module
          </span>
        </div>

        <Link
          to={`/projects/${projectId}/settings/structure`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-xs cursor-pointer"
        >
          <Settings size={12} className="text-zinc-400" />
          <span>Configure Submodule</span>
        </Link>
      </div>

      {/* Configured Layout: Tabs */}
      {config.layout === 'tabs' && (
        <div className="space-y-6">
          {/* Tab Navigation Ribbon */}
          <div className="flex items-center gap-2 border-b border-[#27272A] bg-[#0E0F15] p-1.5 rounded-xl">
            {config.features.map((featKey) => {
              const meta = getFeatureMeta(featKey);
              const isActive = activeTab === featKey;

              return (
                <button
                  key={featKey}
                  type="button"
                  onClick={() => {
                    setActiveTab(featKey);
                    setActiveFilter({});
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2',
                    isActive
                      ? 'bg-zinc-800 text-white shadow-xs border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  )}
                >
                  <span style={{ color: isActive ? accentColor : undefined }}>●</span>
                  <span>{meta.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Feature View */}
          <GitFeatureRenderer
            featureKey={activeTab}
            projectId={projectId}
            configuredCards={config.summaryCards}
            initialFilter={activeFilter}
            onNavigateToFeature={handleNavigateToFeature}
          />
        </div>
      )}

      {/* Configured Layout: Stacked */}
      {config.layout === 'stacked' && (
        <div className="space-y-8">
          {config.features.map((featKey) => {
            const meta = getFeatureMeta(featKey);
            return (
              <div key={featKey} className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-[#27272A]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                  <h3 className="text-sm font-semibold text-white">{meta.title}</h3>
                  <span className="text-xs text-zinc-500">{meta.description}</span>
                </div>

                <GitFeatureRenderer
                  featureKey={featKey}
                  projectId={projectId}
                  configuredCards={config.summaryCards}
                  onNavigateToFeature={handleNavigateToFeature}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Configured Layout: Split */}
      {config.layout === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {config.features.slice(0, 2).map((featKey) => {
            const meta = getFeatureMeta(featKey);
            return (
              <div key={featKey} className="p-4 rounded-2xl border border-[#27272A] bg-[#0E0F15] space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{meta.title}</h3>
                </div>

                <GitFeatureRenderer
                  featureKey={featKey}
                  projectId={projectId}
                  configuredCards={config.summaryCards}
                  onNavigateToFeature={handleNavigateToFeature}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

