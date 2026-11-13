import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, FolderKanban } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const { mode, activeProject, projectModules } = useNavigation();

  const pathnames = location.pathname.split('/').filter((x) => x);

  // Dynamically resolve submodule name from ID route
  const activeSubmodule = useMemo(() => {
    const subMatch = location.pathname.match(/\/submodules\/(\d+)/);
    if (subMatch) {
      const subId = parseInt(subMatch[1], 10);
      for (const mod of projectModules || []) {
        const found = mod.submodules?.find((s) => s.id === subId);
        if (found) return found;
      }
    }
    const modMatch = location.pathname.match(/\/modules\/(\d+)/);
    if (modMatch) {
      const modId = parseInt(modMatch[1], 10);
      const foundMod = (projectModules || []).find((m) => m.id === modId);
      if (foundMod) return { id: foundMod.id, name: foundMod.name };
    }
    const lastSeg = pathnames[pathnames.length - 1];
    if (lastSeg) {
      for (const mod of projectModules || []) {
        const found = mod.submodules?.find((s) => s.builtInKey === lastSeg);
        if (found) return found;
      }
    }
    return null;
  }, [location.pathname, projectModules, pathnames]);

  // Format breadcrumb segment fallback
  const formatSegment = (str: string) => {
    if (/^\d+$/.test(str)) {
      return `#${str}`;
    }
    if (str === 'connections') return 'Connected Accounts';
    if (str === 'labels') return 'Labels & Categories';
    if (str === 'status') return 'Status & Workflow';
    if (str === 'security') return 'Security & Access';
    if (str === 'structure') return 'Project Structure';
    if (str === 'overview') return 'Overview';
    return str
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const projectBasePath = activeProject ? `/projects/${activeProject.id}` : '/projects';

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
            to={projectBasePath}
            className="text-zinc-300 hover:text-white transition-colors truncate flex items-center gap-1 font-medium"
          >
            <FolderKanban size={13} className="text-blue-400 shrink-0" />
            <span className="truncate">{activeProject.title}</span>
          </Link>

          {activeSubmodule ? (
            <>
              <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
              <span className="text-white font-semibold truncate">
                {activeSubmodule.name}
              </span>
            </>
          ) : pathnames.length > 2 ? (
            <>
              <ChevronRight size={13} className="text-zinc-600 flex-shrink-0" />
              <span className="text-zinc-300 font-medium truncate">
                {formatSegment(pathnames[pathnames.length - 1])}
              </span>
            </>
          ) : null}
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
