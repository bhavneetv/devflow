import React from 'react';

export const ProjectOverviewSkeleton: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/80" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-48 h-7 rounded-lg bg-zinc-800" />
              <div className="w-20 h-5 rounded-full bg-zinc-800/60" />
              <div className="w-16 h-5 rounded-full bg-zinc-800/60" />
            </div>
            <div className="w-64 h-4 rounded bg-zinc-800/60" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28 h-9 rounded-lg bg-zinc-800" />
          <div className="w-28 h-9 rounded-lg bg-zinc-800" />
        </div>
      </div>

      {/* 6 Stat Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3"
          >
            <div className="w-20 h-4 rounded bg-zinc-800/60" />
            <div className="w-16 h-8 rounded bg-zinc-800" />
            <div className="w-24 h-3.5 rounded bg-zinc-800/50" />
          </div>
        ))}
      </div>

      {/* Two Column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress Card Skeleton */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="w-32 h-5 rounded bg-zinc-800" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <div className="w-24 h-4 rounded bg-zinc-800/60" />
                    <div className="w-10 h-4 rounded bg-zinc-800/60" />
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800/80" />
                </div>
              ))}
            </div>
          </div>

          {/* Analytics 3 Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 min-h-[220px] flex flex-col justify-between"
              >
                <div className="w-28 h-4 rounded bg-zinc-800/60" />
                <div className="w-full h-28 rounded-lg bg-zinc-800/40" />
                <div className="w-20 h-3 rounded bg-zinc-800/50" />
              </div>
            ))}
          </div>

          {/* Recent Tasks Skeleton */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
            <div className="w-32 h-5 rounded bg-zinc-800" />
            <div className="divide-y divide-zinc-800/60">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-5 rounded bg-zinc-800" />
                    <div className="w-48 h-4 rounded bg-zinc-800/70" />
                  </div>
                  <div className="w-20 h-5 rounded-full bg-zinc-800/60" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-4">
          {/* Development Activity Feed Skeleton */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="w-40 h-5 rounded bg-zinc-800" />
            <div className="space-y-3.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-800 mt-1 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-full h-3.5 rounded bg-zinc-800/70" />
                    <div className="w-16 h-2.5 rounded bg-zinc-800/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines Skeleton */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="w-36 h-5 rounded bg-zinc-800" />
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-6 rounded bg-zinc-800" />
                    <div className="w-28 h-4 rounded bg-zinc-800/70" />
                  </div>
                  <div className="w-16 h-5 rounded-full bg-zinc-800/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

