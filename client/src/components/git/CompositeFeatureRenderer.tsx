import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Settings,
} from 'lucide-react';
import type { ProjectSubmodule } from '../../types/module';
import { BUILT_IN_SUBMODULE_DEFINITIONS } from '../../types/module';
import type { CompositeSubmoduleConfig } from '../../types/git';
import { GIT_FEATURES_REGISTRY } from '../../types/git';
import { GitFeatureRenderer } from './GitFeatureRenderer';
import { resolveModuleIcon } from '../project/ModuleIconPicker';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { cn } from '../../lib/utils';

// Universal feature imports
import { WhiteboardView } from '../../views/project/WhiteboardView';
import { DocumentsKnowledgeBaseModule } from '../documents/DocumentsKnowledgeBaseModule';
import { DevelopmentManagementModule } from '../development/DevelopmentManagementModule';
import { TestingOverviewView } from '../../views/project/testing/TestingOverviewView';
import { TestCasesView } from '../../views/project/testing/TestCasesView';
import { TestSuitesView } from '../../views/project/testing/TestSuitesView';
import { TestPlansView } from '../../views/project/testing/TestPlansView';
import { TestRunsView } from '../../views/project/testing/TestRunsView';
import { DefectsView } from '../../views/project/testing/DefectsView';
import { TestReportsView } from '../../views/project/testing/TestReportsView';
import { TestingSettingsView } from '../../views/project/testing/TestingSettingsView';

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
        features: ['testing-overview', 'defects'],
        layout: 'tabs',
        defaultTab: 'testing-overview',
      };
    }
    try {
      const parsed = JSON.parse(submodule.config);
      return {
        features: Array.isArray(parsed.features) && parsed.features.length > 0
          ? parsed.features
          : ['testing-overview', 'defects'],
        summaryCards: Array.isArray(parsed.summaryCards) ? parsed.summaryCards : undefined,
        layout: 'tabs',
        defaultTab: parsed.defaultTab || parsed.features?.[0] || 'testing-overview',
        defaultRepoFilter: parsed.defaultRepoFilter,
      };
    } catch {
      return {
        features: ['testing-overview', 'defects'],
        layout: 'tabs',
        defaultTab: 'testing-overview',
      };
    }
  }, [submodule.config]);

  const [activeTab, setActiveTab] = useState<string>(
    config.defaultTab || config.features[0] || 'testing-overview'
  );
  const [activeFilter, setActiveFilter] = useState<Record<string, any>>({});

  const SubIcon = resolveModuleIcon(submodule.icon, Boxes);

  const getFeatureMeta = (key: string) => {
    // 1. Check GIT_FEATURES_REGISTRY
    const gitMatch = GIT_FEATURES_REGISTRY.find((f) => f.key === key);
    if (gitMatch) return gitMatch;

    // 2. Check BUILT_IN_SUBMODULE_DEFINITIONS
    const builtInMatch = BUILT_IN_SUBMODULE_DEFINITIONS.find((b) => b.key === key);
    if (builtInMatch) {
      return {
        key: builtInMatch.key,
        title: builtInMatch.defaultName,
        description: builtInMatch.description,
        icon: builtInMatch.defaultIcon,
      };
    }

    // 3. Fallback
    return {
      key,
      title: key.replace(/[-_.]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: '',
      icon: 'boxes',
    };
  };

  const handleNavigateToFeature = (featureKey: string, filter?: Record<string, any>) => {
    setActiveTab(featureKey);
    if (filter) setActiveFilter(filter);
  };

  const renderFeatureContent = (featKey: string) => {
    // 1. Testing & QA features
    if (featKey === 'testing-overview') {
      return <TestingOverviewView projectId={projectId} />;
    }
    if (featKey === 'test-cases') {
      return <TestCasesView projectId={projectId} />;
    }
    if (featKey === 'test-suites') {
      return <TestSuitesView projectId={projectId} />;
    }
    if (featKey === 'test-plans') {
      return <TestPlansView projectId={projectId} />;
    }
    if (featKey === 'test-runs') {
      return <TestRunsView projectId={projectId} />;
    }
    if (featKey === 'defects') {
      return <DefectsView projectId={projectId} />;
    }
    if (featKey === 'test-reports') {
      return <TestReportsView projectId={projectId} />;
    }
    if (featKey === 'testing-settings') {
      return <TestingSettingsView projectId={projectId} />;
    }

    // 2. Documents
    if (['docs', 'documents', 'documents.knowledge_base'].includes(featKey)) {
      return (
        <DocumentsKnowledgeBaseModule
          projectId={projectId}
          submoduleId={submodule.id}
          submoduleName={submodule.name}
        />
      );
    }

    // 3. Whiteboard
    if (featKey === 'whiteboard') {
      return (
        <WhiteboardView
          submoduleId={submodule.id}
          submoduleName={submodule.name}
        />
      );
    }

    // 4. Development Management
    if (['development', 'development.management', 'overview'].includes(featKey)) {
      return <DevelopmentManagementModule projectId={projectId} />;
    }

    // 5. Git Features (via GitFeatureRenderer)
    const gitKey = featKey.startsWith('git.')
      ? featKey
      : featKey === 'pulls' || featKey === 'git-pulls'
      ? 'git.merge_requests'
      : featKey === 'repositories'
      ? 'git.repositories'
      : featKey === 'issues'
      ? 'git.issues'
      : featKey === 'commits' || featKey === 'git-commits'
      ? 'git.commits'
      : featKey === 'code' || featKey === 'git-code'
      ? 'git.code'
      : featKey === 'git-overview'
      ? 'git.overview'
      : null;

    if (gitKey) {
      return (
        <GitFeatureRenderer
          featureKey={gitKey as any}
          projectId={projectId}
          configuredCards={config.summaryCards}
          initialFilter={activeFilter}
          onNavigateToFeature={handleNavigateToFeature}
        />
      );
    }

    // 6. Generic / Custom Fallback
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed border-[#27272A] bg-[#0E0F15] text-zinc-400 space-y-2">
        <Boxes size={24} className="mx-auto text-zinc-500" />
        <h3 className="text-sm font-semibold text-white">Active Feature: {featKey}</h3>
        <p className="text-xs text-zinc-500">This feature is combined inside the composite tab.</p>
      </div>
    );
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

      {/* Universal Combined Layout: Tab Switcher */}
      <div className="space-y-6">
        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1.5 border-b border-[#27272A] bg-[#0E0F15] p-1.5 rounded-xl overflow-x-auto scrollbar-thin">
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
                  'px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap border',
                  isActive
                    ? 'bg-zinc-800 text-white shadow-xs border-zinc-700'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/40'
                )}
                style={
                  isActive
                    ? { borderColor: `${accentColor}70`, backgroundColor: `${accentColor}18` }
                    : undefined
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isActive ? accentColor : '#52525B' }}
                />
                <span>{meta.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Feature View */}
        <div className="min-w-0">
          {renderFeatureContent(activeTab)}
        </div>
      </div>
    </div>
  );
};

