import React from 'react';
import { useParams } from 'react-router-dom';
import { DevelopmentManagementModule } from '../../components/development/DevelopmentManagementModule';

export const DevelopmentManagementView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id, 10) : 0;

  if (!projectId) {
    return (
      <div className="p-12 text-center text-xs text-zinc-500">
        Project not found.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <DevelopmentManagementModule projectId={projectId} />
    </div>
  );
};

