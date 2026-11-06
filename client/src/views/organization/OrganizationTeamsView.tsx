import React from 'react';
import { TeamView } from '../TeamView';

/**
 * OrganizationTeamsView reuses the comprehensive Teams Index UI created in TeamView.tsx.
 * It automatically scopes teams to the active organization from URL params / OrganizationContext.
 */
export const OrganizationTeamsView: React.FC = () => {
  return <TeamView />;
};

export default OrganizationTeamsView;
