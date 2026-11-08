import React from 'react';
import type { GitFeatureKey } from '../../types/git';
import { GitOverview } from './GitOverview';
import { GitRepositoryList } from './GitRepositoryList';
import { GitIssuesView } from './GitIssuesView';
import { GitMergeRequestsView } from './GitMergeRequestsView';
import { GitCommitsView } from './GitCommitsView';
import { GitCodeBrowserView } from './GitCodeBrowserView';

export interface GitFeatureRendererProps {
  featureKey: GitFeatureKey | string;
  projectId: number;
  configuredCards?: string[];
  initialFilter?: Record<string, any>;
  onNavigateToFeature?: (featureKey: string, initialFilter?: Record<string, any>) => void;
}

/**
 * Universal Git Feature Renderer
 * Dispatches to the single shared implementation for each Git feature.
 * Guarantees zero code or business logic duplication between built-in pages
 * and custom composite submodules.
 */
export const GitFeatureRenderer: React.FC<GitFeatureRendererProps> = ({
  featureKey,
  projectId,
  configuredCards,
  initialFilter,
  onNavigateToFeature,
}) => {
  switch (featureKey) {
    case 'git.overview':
      return (
        <GitOverview
          projectId={projectId}
          configuredCards={configuredCards}
          onNavigateToFeature={onNavigateToFeature}
        />
      );
    case 'git.repositories':
      return <GitRepositoryList projectId={projectId} />;
    case 'git.issues':
      return <GitIssuesView projectId={projectId} initialFilter={initialFilter} />;
    case 'git.merge_requests':
      return <GitMergeRequestsView projectId={projectId} initialFilter={initialFilter} />;
    case 'git.commits':
      return <GitCommitsView projectId={projectId} />;
    case 'git.code':
      return <GitCodeBrowserView projectId={projectId} />;
    default:
      return (
        <div className="p-8 text-center text-xs text-zinc-500">
          Unrecognized Git Feature Key: <code>{featureKey}</code>
        </div>
      );
  }
};

