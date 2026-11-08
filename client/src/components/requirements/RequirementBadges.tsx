import React from 'react';
import {
  RequirementWorkflowStatus,
  RequirementImplementationStatus,
  RequirementPriority,
  RequirementType,
} from '../../services/requirement.service';

/**
 * Workflow Status Badge
 * UI/UX Rules:
 *   Draft = gray
 *   Pending Review = amber
 *   Changes Requested = orange
 *   Approved = green
 *   Rejected = red
 *   Deprecated = slate
 *   Archived = outline
 */
export const WorkflowStatusBadge: React.FC<{
  status: RequirementWorkflowStatus;
  size?: 'sm' | 'md';
}> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'DRAFT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Draft
        </span>
      );
    case 'PENDING_REVIEW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Pending Review
        </span>
      );
    case 'CHANGES_REQUESTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          Changes Requested
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Approved
        </span>
      );
    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Rejected
        </span>
      );
    case 'DEPRECATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Deprecated
        </span>
      );
    case 'ARCHIVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-transparent text-zinc-400 border border-dashed border-zinc-600 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Archived
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-zinc-800 text-zinc-400 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

/**
 * Priority Badge
 * UI/UX Rules:
 *   Critical = solid red
 *   High = red outline
 *   Medium = amber
 *   Low = gray
 */
export const PriorityBadge: React.FC<{
  priority: RequirementPriority;
  size?: 'sm' | 'md';
}> = ({ priority, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs';

  switch (priority) {
    case 'CRITICAL':
      return (
        <span
          className={`inline-flex items-center font-bold tracking-wide rounded uppercase bg-red-600 text-white shadow-sm shadow-red-900/40 ${sizeClasses}`}
        >
          Critical
        </span>
      );
    case 'HIGH':
      return (
        <span
          className={`inline-flex items-center font-semibold tracking-wide rounded uppercase bg-red-950/40 text-red-400 border border-red-500/60 ${sizeClasses}`}
        >
          High
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          className={`inline-flex items-center font-medium tracking-wide rounded uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 ${sizeClasses}`}
        >
          Medium
        </span>
      );
    case 'LOW':
      return (
        <span
          className={`inline-flex items-center font-medium tracking-wide rounded uppercase bg-zinc-800/80 text-zinc-400 border border-zinc-700/50 ${sizeClasses}`}
        >
          Low
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded bg-zinc-800 text-zinc-400 ${sizeClasses}`}>
          {priority}
        </span>
      );
  }
};

/**
 * Implementation Status Badge (Separate field per Rule 2)
 */
export const ImplementationStatusBadge: React.FC<{
  status: RequirementImplementationStatus;
  size?: 'sm' | 'md';
}> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'NOT_STARTED':
      return (
        <span className={`inline-flex items-center rounded bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 ${sizeClasses}`}>
          Not Started
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className={`inline-flex items-center rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-medium ${sizeClasses}`}>
          In Progress
        </span>
      );
    case 'BLOCKED':
      return (
        <span className={`inline-flex items-center rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold ${sizeClasses}`}>
          Blocked
        </span>
      );
    case 'IMPLEMENTED':
      return (
        <span className={`inline-flex items-center rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 font-medium ${sizeClasses}`}>
          Implemented
        </span>
      );
    case 'VERIFIED':
      return (
        <span className={`inline-flex items-center rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold ${sizeClasses}`}>
          Verified
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center rounded bg-zinc-800 text-zinc-400 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

/**
 * Requirement Type Badge
 */
export const RequirementTypeBadge: React.FC<{ type: RequirementType }> = ({ type }) => {
  const formatted = type.replace('_', ' ');
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
      {formatted}
    </span>
  );
};

