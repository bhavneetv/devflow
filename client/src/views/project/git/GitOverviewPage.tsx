import React from 'react';
import { useParams } from 'react-router-dom';
import { GitOverview } from '../../../components/git/GitOverview';

export const GitOverviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id, 10) : 1;

  return (
    <div className="w-full px-4 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-16 space-y-5">
      <GitOverview projectId={projectId} />
    </div>
  );
};
