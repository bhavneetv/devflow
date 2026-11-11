import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { DocumentsKnowledgeBaseModule } from '../../components/documents/DocumentsKnowledgeBaseModule';
import { useNavigation } from '../../context/NavigationContext';

export const DocumentsKnowledgeBaseView: React.FC = () => {
  const { id, submoduleId } = useParams<{ id: string; submoduleId?: string }>();
  const projectId = id ? parseInt(id, 10) : 0;
  const subId = submoduleId ? parseInt(submoduleId, 10) : undefined;
  const { activeProject } = useNavigation();

  if (!projectId) {
    return (
      <div className="p-12 text-center text-xs text-zinc-500">
        Project not found.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      <DocumentsKnowledgeBaseModule
        projectId={projectId}
        submoduleId={subId}
        submoduleName="Documents & Knowledge Base"
      />
    </div>
  );
};

