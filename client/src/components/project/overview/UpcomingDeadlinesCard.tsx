import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

interface DeadlineItem {
  id: string | number;
  date: string;
  dateFormatted: string;
  title: string;
  kind: 'OVERDUE' | 'DUE_SOON' | 'SPRINT' | 'MILESTONE';
  link: string;
}

interface UpcomingDeadlinesCardProps {
  deadlines: DeadlineItem[];
}

export const UpcomingDeadlinesCard: React.FC<UpcomingDeadlinesCardProps> = ({ deadlines }) => {
  const getBadgeStyle = (kind: DeadlineItem['kind']) => {
    switch (kind) {
      case 'OVERDUE':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'DUE_SOON':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'SPRINT':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'MILESTONE':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getLabel = (kind: DeadlineItem['kind']) => {
    switch (kind) {
      case 'OVERDUE':
        return 'Overdue';
      case 'DUE_SOON':
        return 'Due soon';
      case 'SPRINT':
        return 'Sprint';
      case 'MILESTONE':
        return 'Milestone';
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide uppercase">
            Upcoming deadlines
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Critical dates & milestones</p>
        </div>
      </div>

      {deadlines.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs">
          <Calendar size={24} className="mx-auto text-zinc-600 mb-2" />
          No deadlines scheduled.
        </div>
      ) : (
        <div className="space-y-2">
          {deadlines.map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between gap-3 text-xs transition-colors group block"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px] font-semibold shrink-0 group-hover:bg-zinc-700 transition-colors">
                  {item.dateFormatted}
                </span>
                <span className="font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
                  {item.title}
                </span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getBadgeStyle(
                  item.kind
                )} shrink-0 transition-transform group-hover:scale-105`}
              >
                {getLabel(item.kind)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

