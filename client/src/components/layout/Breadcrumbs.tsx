import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, FolderKanban } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const { mode, activeProject } = useNavigation();

  const pathnames = location.pathname.split('/').filter((x) => x);

  // Format breadcrumb segment
  const formatSegment = (str: string) => {
    if (/^\d+$/.test(str)) {
      return `#${str}`;
    }
    if (str === 'connections') return 'Connected Accounts';
    if (str === 'labels') return 'Labels & Categories';
    if (str === 'status') return 'Status & Workflow';
    if (str === 'security') return 'Security & Access';
    if (str === 'overview') return 'Overview';
    return str
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs text-zinc-400 truncate select-none">
      <Link
        to="/"
        className="hover:text-zinc-200 transition-colors font-medium text-zinc-300"
      >
        DevFlow
      </Link>

      {mode === 'project' && activeProject ? (
        <>
          <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
          <Link
            to="/projects"
            className="hover:text-zinc-200 transition-colors truncate"
          >
            Projects
          </Link>
          <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
          <span className="text-white font-medium truncate flex items-center gap-1">
            <FolderKanban size={13} className="text-blue-400" />
            <span className="truncate">{activeProject.title}</span>
          </span>
          {pathnames.length > 2 && (
            <>
              <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
              <span className="text-zinc-300 font-medium truncate">
                {formatSegment(pathnames[pathnames.length - 1])}
              </span>
            </>
          )}
        </>
      ) : pathnames.length === 0 ? (
        <>
          <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
          <span className="text-zinc-200 font-medium">Overview</span>
        </>
      ) : (
        pathnames.map((segment, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;

          return (
            <React.Fragment key={routeTo}>
              <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
              {isLast ? (
                <span className="text-zinc-200 font-medium truncate">
                  {formatSegment(segment)}
                </span>
              ) : (
                <Link
                  to={routeTo}
                  className="hover:text-zinc-200 transition-colors truncate"
                >
                  {formatSegment(segment)}
                </Link>
              )}
            </React.Fragment>
          );
        })
      )}
    </nav>
  );
};
