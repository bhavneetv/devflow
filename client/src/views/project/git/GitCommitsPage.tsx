import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitCommitsView } from '../../../components/git/GitCommitsView';
import { useNavigation } from '../../../context/NavigationContext';

export const GitCommitsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id, 10) : 1;
  const { activeProject } = useNavigation();

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link to={`/projects/${projectId}`} className="hover:text-white transition-colors">
          {activeProject?.title || 'Project'}
        </Link>
        <span>/</span>
        <span className="text-white font-medium">Commits</span>
      </div>

      <GitCommitsView projectId={projectId} />
    </div>
  );
};

