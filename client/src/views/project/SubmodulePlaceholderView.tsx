import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ArrowLeft,
  Settings,
  FolderTree,
  Sparkles,
  Info,
  CircleDot,
  Loader2,
  FolderKanban,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { useNavigation } from '../../context/NavigationContext';
import { projectModuleService } from '../../services/projectModule.service';
import { resolveModuleIcon } from '../../components/project/ModuleIconPicker';
import { ProjectModule, ProjectSubmodule } from '../../types/module';
import { CompositeFeatureRenderer } from '../../components/git/CompositeFeatureRenderer';
import { GitMergeRequestsView } from '../../components/git/GitMergeRequestsView';
import { GitCommitsView } from '../../components/git/GitCommitsView';
import { GitCodeBrowserView } from '../../components/git/GitCodeBrowserView';
import { GitRepositoryList } from '../../components/git/GitRepositoryList';
import { GitOverview } from '../../components/git/GitOverview';
import { GitIssuesView } from '../../components/git/GitIssuesView';

export const SubmodulePlaceholderView: React.FC = () => {
  const { id, submoduleId, moduleId } = useParams<{ id: string; submoduleId?: string; moduleId?: string }>();
  const projectId = id ? parseInt(id, 10) : 1;
  const subId = submoduleId ? parseInt(submoduleId, 10) : 0;
  const modId = moduleId ? parseInt(moduleId, 10) : 0;

  const { accentColor } = useAccentTheme();
  const { exitProjectMode, activeProject } = useNavigation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<ProjectModule | null>(null);
  const [submodule, setSubmodule] = useState<ProjectSubmodule | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSubmoduleData = async () => {
      try {
        setLoading(true);
        const res = await projectModuleService.getModules(projectId);
        if (isMounted && res.success && res.data) {
          for (const m of res.data) {
            if (modId && m.id === modId) {
              setModule(m);
              break;
            }
            const found = m.submodules?.find((s) => s.id === subId);
            if (found) {
              setModule(m);
              setSubmodule(found);
              break;
            }
          }
        }
      } catch (err) {
        console.error('Failed to load submodule placeholder info:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSubmoduleData();
    return () => {
      isMounted = false;
    };
  }, [projectId, subId, modId]);

  const isIndependent = !!module && !submodule;
  const SubIcon = resolveModuleIcon(submodule?.icon || module?.icon, isIndependent ? FolderKanban : CircleDot);
  const ModIcon = resolveModuleIcon(module?.icon, FolderKanban);

  if (loading) {
    return (
      <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin text-zinc-400" />
        <span>Loading {isIndependent ? 'module' : 'submodule'}...</span>
      </div>
    );
  }

  if (submodule && submodule.type === 'composite') {
    return <CompositeFeatureRenderer projectId={projectId} submodule={submodule} />;
  }

  if (submodule && submodule.builtInKey) {
    const key = submodule.builtInKey;
    let content = null;
    if (key === 'pulls' || key === 'git-pulls') {
      content = <GitMergeRequestsView projectId={projectId} />;
    } else if (key === 'git-commits' || key === 'commits') {
      content = <GitCommitsView projectId={projectId} />;
    } else if (key === 'git-code' || key === 'code') {
      content = <GitCodeBrowserView projectId={projectId} />;
    } else if (key === 'repositories') {
      content = <GitRepositoryList projectId={projectId} />;
    } else if (key === 'git-overview') {
      content = <GitOverview projectId={projectId} />;
    } else if (key === 'issues') {
      content = <GitIssuesView projectId={projectId} />;
    }

    if (content) {
      return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Link to={`/projects/${projectId}`} className="hover:text-white transition-colors">
              {activeProject?.title || 'Project'}
            </Link>
            <span>/</span>
            <span className="text-white font-medium">{submodule.name}</span>
          </div>
          {content}
        </div>
      );
    }
  }

  const displayName = isIndependent ? module?.name : submodule?.name;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <Link to={`/projects/${projectId}`} className="hover:text-white transition-colors">
            {activeProject?.title || 'Project'}
          </Link>
          <span>/</span>
          {module && !isIndependent && (
            <>
              <span className="flex items-center gap-1 text-zinc-300">
                <ModIcon size={12} style={{ color: accentColor }} />
                <span>{module.name}</span>
              </span>
              <span>/</span>
            </>
          )}
          <span className="text-white font-medium">{displayName || 'Feature'}</span>
        </div>

        <Link
          to={`/projects/${projectId}/settings/sidebar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-sm cursor-pointer"
        >
          <Settings size={12} className="text-zinc-400" />
          <span>Sidebar Settings</span>
        </Link>
      </div>

      {/* Main Structural Placeholder Card */}
      <div className="p-8 sm:p-12 rounded-2xl border border-[#27272A] bg-[#0E0F14] text-center flex flex-col items-center justify-center space-y-5 shadow-sm">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-white/10"
          style={{ backgroundColor: `${accentColor}25` }}
        >
          <SubIcon size={30} style={{ color: accentColor }} />
        </div>

        <div className="space-y-2 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            {isIndependent ? 'Independent Module • Direct Link' : 'Custom Submodule • Structural Placeholder'}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {displayName || 'Feature Placeholder'}
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {isIndependent ? (
              <>
                This module <strong className="text-zinc-200">"{module?.name}"</strong> acts as an independent standalone navigation page in your project workspace.
              </>
            ) : (
              <>
                This submodule is currently a structural placeholder in your project workspace under module{' '}
                <strong className="text-zinc-200">"{module?.name || 'Custom Module'}"</strong>.
              </>
            )}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-[#121319] max-w-lg text-left text-xs text-zinc-400 space-y-2">
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            <Info size={14} style={{ color: accentColor }} />
            <span>Project Navigation Info</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            You can customize, reorder, or rename this submodule anytime, or adjust its sidebar visibility
            directly from the <strong className="text-zinc-300">Project Structure</strong> settings page.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors shadow-sm"
          >
            <ArrowLeft size={13} />
            <span>Return to Project Overview</span>
          </Link>

          <Link
            to={`/projects/${projectId}/settings/structure`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <FolderTree size={13} />
            <span>Manage Project Structure</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

