import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  FileText,
  CheckSquare,
  AlertTriangle,
  History,
  Send,
  Split,
  Eye,
  Info,
  Layers,
  HelpCircle,
  Check,
} from 'lucide-react';
import {
  requirementService,
  RequirementType,
  RequirementPriority,
  RequirementWorkflowStatus,
} from '../../services/requirement.service';
import {
  WorkflowStatusBadge,
  PriorityBadge,
  ImplementationStatusBadge,
  RequirementTypeBadge,
} from '../../components/requirements/RequirementBadges';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { can } from '../../services/requirementPermissions.service';

export const RequirementReviewView: React.FC = () => {
  const { id: routeProjectId, reqId } = useParams<{ id?: string; reqId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentRole } = useOrganization();

  // Target requirement ID
  const activeReqId = reqId || routeProjectId;

  // Requirement data state
  const [requirement, setRequirement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review form state
  const [decision, setDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'>('APPROVED');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    clearJustification: false,
    measurableCriteria: false,
    noCircularDeps: false,
    feasibleConstraints: false,
  });
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Diff inspection modal state (for re-review)
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [showDepWarningModal, setShowDepWarningModal] = useState(false);

  // User context for permissions
  const userContext = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orgRole: (currentRole as any) || (user.role as any) || 'MEMBER',
      projectRole: 'MANAGER' as any,
      isProjectOwner: currentRole === 'OWNER',
    };
  }, [user, currentRole]);

  // Load requirement
  const loadRequirement = useCallback(async () => {
    if (!activeReqId) return;
    try {
      setIsLoading(true);
      const res = await requirementService.getRequirementById(activeReqId);
      if (res.success && res.data) {
        setRequirement(res.data);
        setErrorMessage(null);
      } else {
        setErrorMessage(res.error || 'Requirement not found');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load requirement for review');
    } finally {
      setIsLoading(false);
    }
  }, [activeReqId]);

  useEffect(() => {
    loadRequirement();
  }, [loadRequirement]);

  // Detect if current user is the author (Rule 4)
  const isAuthor = useMemo(() => {
    if (!user || !requirement) return false;
    return user.id === requirement.authorId;
  }, [user, requirement]);

  // Criteria count
  const criteriaCount = requirement?.acceptanceCriteria?.length || 0;
  const hasZeroCriteria = criteriaCount === 0;

  // Check if re-review is needed (e.g. version > 1 and in review)
  const isReReview = requirement?.currentVersion > 1;

  // Check for non-viable dependencies (REJECTED or DEPRECATED)
  const problematicDependencies = useMemo(() => {
    if (!requirement?.dependenciesFrom) return [];
    return requirement.dependenciesFrom.filter(
      (dep: any) =>
        dep.toRequirement?.workflowStatus === 'REJECTED' ||
        dep.toRequirement?.workflowStatus === 'DEPRECATED'
    );
  }, [requirement]);

  // Checklist helper
  const handleToggleChecklist = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Permission check
  const reviewPermission = useMemo(() => {
    if (!userContext || !requirement) {
      return { canReview: false, canApprove: false, reason: 'Unauthenticated' };
    }
    const resource = {
      id: requirement.id,
      code: requirement.code,
      projectId: requirement.projectId,
      authorId: requirement.authorId,
      reviewerId: requirement.reviewerId,
      workflowStatus: requirement.workflowStatus,
    };
    const revCheck = can(userContext, 'review', resource);
    const appCheck = can(userContext, 'approve', resource);
    return {
      canReview: revCheck.allowed,
      canApprove: appCheck.allowed,
      reason: appCheck.reason || revCheck.reason,
    };
  }, [userContext, requirement]);

  // Handle Review Submission
  const handleSubmitReview = async (e?: React.FormEvent, bypassDepWarning = false) => {
    if (e) e.preventDefault();
    if (!requirement) return;
    setSubmitError(null);

    // Rule 4 Guard: Author CANNOT approve own requirement
    if (decision === 'APPROVED' && isAuthor) {
      setSubmitError(
        'Governance Rule 4: The author cannot approve their own requirement. Another reviewer must approve.'
      );
      return;
    }

    // Zero-criteria guard
    if (decision === 'APPROVED' && hasZeroCriteria) {
      setSubmitError('Cannot approve a requirement with zero acceptance criteria.');
      return;
    }

    // Mandatory comment check
    if ((decision === 'CHANGES_REQUESTED' || decision === 'REJECTED') && !reviewComment.trim()) {
      setSubmitError(
        `A review comment is required when ${decision === 'REJECTED' ? 'rejecting' : 'requesting changes'}.`
      );
      return;
    }

    // Non-viable dependency check on approval
    if (decision === 'APPROVED' && problematicDependencies.length > 0 && !bypassDepWarning) {
      setShowDepWarningModal(true);
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await requirementService.submitReview(requirement.id, {
        decision,
        checklist,
        comment: reviewComment.trim() || undefined,
        reviewerId: user?.id,
      });

      if (res.success) {
        // Navigate back to detail page on success
        navigate(`/projects/${requirement.projectId}/requirements/${requirement.id}`);
      } else {
        setSubmitError(res.error || 'Failed to submit review');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error conducting review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 space-y-6">
        <div className="h-8 w-64 rounded bg-zinc-800 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-96 rounded-xl bg-zinc-900 animate-pulse" />
          <div className="lg:col-span-5 h-96 rounded-xl bg-zinc-900 animate-pulse" />
        </div>
      </div>
    );
  }

  if (errorMessage || !requirement) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 flex flex-col items-center justify-center">
        <AlertCircle size={36} className="text-red-400 mb-3" />
        <h2 className="text-xl font-bold mb-2">Requirement Not Available</h2>
        <p className="text-sm text-zinc-400 mb-6">{errorMessage || 'Requirement not found'}</p>
        <button
          onClick={() => navigate('/requirements')}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white flex items-center gap-2"
        >
          <ArrowLeft size={15} /> Back to Requirements
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* 1. TOP HEADER */}
      <div className="border-b border-[#27272A] bg-[#0E0E10] px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link
                to={`/projects/${requirement.projectId}/requirements/${requirement.id}`}
                className="hover:text-zinc-200 transition-colors flex items-center gap-1 text-blue-400"
              >
                <ArrowLeft size={14} /> Back to {requirement.code}
              </Link>
              <ChevronRight size={13} className="text-zinc-600" />
              <span>Specification Formal Review</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                REVIEW MODE
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {requirement.code}: {requirement.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WorkflowStatusBadge status={requirement.workflowStatus} />
            <PriorityBadge priority={requirement.priority} />
            <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
              v{requirement.currentVersion}
            </span>
          </div>
        </div>
      </div>

      {/* 2. RE-REVIEW NOTICE BANNER */}
      {isReReview && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span>
                <strong>Re-Review Flagged:</strong> This specification is currently on revision <strong>v{requirement.currentVersion}</strong>. Modifications have been made since the previous approval.
              </span>
            </div>
            {requirement.versions?.length >= 2 && (
              <button
                onClick={() => setIsDiffOpen(true)}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium text-xs flex items-center gap-1 border border-amber-500/40"
              >
                <Split size={12} /> Inspect Revision Diff
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN SPLIT VIEW */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================= LEFT (7 COLS): FULL SPECIFICATION ================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Summary Callout */}
          {requirement.summary && (
            <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                Specification Summary
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">{requirement.summary}</p>
            </div>
          )}

          {/* Detailed Description */}
          <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
              <FileText size={14} className="text-blue-400" /> Full Description
            </h3>
            {requirement.description ? (
              <div className="text-xs md:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {requirement.description}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No description provided.</p>
            )}
          </div>

          {/* Behavior & Architecture Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Expected Behavior */}
            <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Sparkles size={13} className="text-amber-400" /> Expected Behavior
              </span>
              <p className="text-zinc-400 leading-relaxed">
                {requirement.expectedBehavior || <span className="text-zinc-600 italic">Unspecified</span>}
              </p>
            </div>

            {/* Business Justification */}
            <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Info size={13} className="text-blue-400" /> Business Justification
              </span>
              <p className="text-zinc-400 leading-relaxed">
                {requirement.businessJustification || <span className="text-zinc-600 italic">Unspecified</span>}
              </p>
            </div>

            {/* Preconditions */}
            <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <Clock size={13} className="text-emerald-400" /> Preconditions
              </span>
              <p className="text-zinc-400 leading-relaxed">
                {requirement.preconditions || <span className="text-zinc-600 italic">Unspecified</span>}
              </p>
            </div>

            {/* Constraints */}
            <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-1.5">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <AlertTriangle size={13} className="text-rose-400" /> Constraints
              </span>
              <p className="text-zinc-400 leading-relaxed">
                {requirement.constraints || <span className="text-zinc-600 italic">Unspecified</span>}
              </p>
            </div>
          </div>

          {/* Acceptance Criteria Section */}
          <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckSquare size={14} className="text-blue-400" /> Acceptance Criteria ({criteriaCount})
              </h3>
              {hasZeroCriteria && (
                <span className="text-[10px] text-red-400 font-semibold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">
                  Zero Criteria Warning
                </span>
              )}
            </div>

            {hasZeroCriteria ? (
              <div className="p-4 rounded-lg bg-red-950/20 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <span>
                  This specification has <strong>0 acceptance criteria</strong>. Governance rules forbid approval of specifications without measurable criteria.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {requirement.acceptanceCriteria.map((ac: any) => (
                  <div
                    key={ac.id}
                    className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          {ac.code}
                        </span>
                        {ac.verificationMethod && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {ac.verificationMethod}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-200 leading-relaxed">{ac.description}</p>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                        ac.isComplete
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {ac.isComplete ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Review History */}
          {requirement.reviews && requirement.reviews.length > 0 && (
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <History size={14} /> Review Audit Log
              </h3>
              <div className="space-y-2.5">
                {requirement.reviews.map((rev: any) => (
                  <div
                    key={rev.id}
                    className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-200">
                          {rev.reviewer?.name || 'Reviewer'}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rev.decision === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : rev.decision === 'CHANGES_REQUESTED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {rev.decision}
                      </span>
                    </div>
                    {rev.comment && <p className="text-zinc-300 italic">"{rev.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT (5 COLS): REVIEW DECISION PANEL ================= */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSubmitReview}
            className="p-6 rounded-2xl bg-[#0E0E10] border border-[#27272A] sticky top-24 space-y-5 shadow-xl"
          >
            {/* Review Panel Header */}
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                Conduct Specification Review
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Submitted by {requirement.author?.name || 'Author'} on{' '}
                {requirement.submittedAt
                  ? new Date(requirement.submittedAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>

            {/* RULE 4 GUARD ALERT */}
            {isAuthor && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <ShieldAlert size={16} /> Governance Rule 4 Enforced
                </div>
                <p className="text-[11.5px] leading-relaxed">
                  You are the <strong>Author</strong> of this specification ({requirement.author?.name}).
                  Per DevFlow Governance Rule 4, <strong>an author can never approve their own requirement</strong>.
                  Approval must be performed by a designated reviewer or manager.
                </p>
              </div>
            )}

            {/* Error Display */}
            {submitError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300">
                {submitError}
              </div>
            )}

            {/* 1. REVIEW CHECKLIST */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                1. Review Checklist
              </label>

              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={checklist.clearJustification}
                    onChange={() => handleToggleChecklist('clearJustification')}
                    className="mt-0.5 rounded bg-zinc-800 border-zinc-700 text-blue-500"
                  />
                  <span className="text-zinc-200">Clear and sound business justification</span>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={checklist.measurableCriteria}
                    onChange={() => handleToggleChecklist('measurableCriteria')}
                    className="mt-0.5 rounded bg-zinc-800 border-zinc-700 text-blue-500"
                  />
                  <span className="text-zinc-200">Measurable and verifiable acceptance criteria</span>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={checklist.noCircularDeps}
                    onChange={() => handleToggleChecklist('noCircularDeps')}
                    className="mt-0.5 rounded bg-zinc-800 border-zinc-700 text-blue-500"
                  />
                  <span className="text-zinc-200">No circular or blocking architecture dependencies</span>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-zinc-700">
                  <input
                    type="checkbox"
                    checked={checklist.feasibleConstraints}
                    onChange={() => handleToggleChecklist('feasibleConstraints')}
                    className="mt-0.5 rounded bg-zinc-800 border-zinc-700 text-blue-500"
                  />
                  <span className="text-zinc-200">Feasible implementation within project constraints</span>
                </label>
              </div>
            </div>

            {/* 2. DECISION SELECTION */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                2. Decision
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {/* Approve Button */}
                <button
                  type="button"
                  disabled={isAuthor || hasZeroCriteria}
                  onClick={() => setDecision('APPROVED')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    decision === 'APPROVED'
                      ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  } ${
                    isAuthor || hasZeroCriteria
                      ? 'opacity-40 cursor-not-allowed hover:border-zinc-800'
                      : ''
                  }`}
                  title={
                    isAuthor
                      ? 'Author cannot approve own requirement (Rule 4)'
                      : hasZeroCriteria
                      ? 'Zero acceptance criteria'
                      : 'Approve requirement'
                  }
                >
                  <CheckCircle2 size={18} className={decision === 'APPROVED' ? 'text-emerald-400' : ''} />
                  <span className="font-semibold text-[11px]">Approve</span>
                </button>

                {/* Request Changes Button */}
                <button
                  type="button"
                  onClick={() => setDecision('CHANGES_REQUESTED')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    decision === 'CHANGES_REQUESTED'
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-md'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <AlertCircle size={18} className={decision === 'CHANGES_REQUESTED' ? 'text-amber-400' : ''} />
                  <span className="font-semibold text-[11px]">Request Changes</span>
                </button>

                {/* Reject Button */}
                <button
                  type="button"
                  onClick={() => setDecision('REJECTED')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    decision === 'REJECTED'
                      ? 'bg-red-950/40 border-red-500 text-red-300 shadow-md'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <XCircle size={18} className={decision === 'REJECTED' ? 'text-red-400' : ''} />
                  <span className="font-semibold text-[11px]">Reject</span>
                </button>
              </div>

              {isAuthor && decision === 'APPROVED' && (
                <span className="text-[10px] text-red-400 italic block">
                  * Author cannot approve their own requirement (governance rule).
                </span>
              )}
            </div>

            {/* 3. REVIEW COMMENT (Mandatory on Request Changes or Reject) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                3. Review Comment {decision !== 'APPROVED' ? '*' : '(Optional)'}
              </label>

              <textarea
                rows={4}
                required={decision !== 'APPROVED'}
                placeholder={
                  decision === 'CHANGES_REQUESTED'
                    ? 'State specific changes required before this can be approved...'
                    : decision === 'REJECTED'
                    ? 'State the reason for rejecting this specification...'
                    : 'Add any optional notes or approval congratulations...'
                }
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmittingReview || (decision === 'APPROVED' && (isAuthor || hasZeroCriteria))}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg ${
                  decision === 'APPROVED'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40'
                    : decision === 'CHANGES_REQUESTED'
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 disabled:opacity-40'
                    : 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-40'
                }`}
              >
                <Send size={13} />
                {isSubmittingReview
                  ? 'Submitting Decision...'
                  : decision === 'APPROVED'
                  ? 'Confirm Approval'
                  : decision === 'CHANGES_REQUESTED'
                  ? 'Submit Changes Requested'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 4. RE-REVIEW DIFF MODAL */}
      {isDiffOpen && requirement.versions?.length >= 2 && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-zinc-700 rounded-2xl max-w-4xl w-full p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Split size={17} className="text-amber-400" />
                  What Changed Since Last Approval (v{requirement.currentVersion - 1} vs v{requirement.currentVersion})
                </h3>
                <span className="text-xs text-zinc-400">
                  Inspect revision delta before rendering review decision
                </span>
              </div>
              <button
                onClick={() => setIsDiffOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {(() => {
              const prevVer = requirement.versions[1];
              const currVer = requirement.versions[0];
              let prevSnap: any = {};
              let currSnap: any = {};
              try {
                if (prevVer) prevSnap = JSON.parse(prevVer.snapshot);
                if (currVer) currSnap = JSON.parse(currVer.snapshot);
              } catch (e) {}

              const fields = ['title', 'summary', 'description', 'expectedBehavior', 'constraints'];

              return (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                  {fields.map((f) => {
                    const beforeVal = prevSnap[f] || '—';
                    const afterVal = currSnap[f] || '—';
                    const isChanged = String(beforeVal).trim() !== String(afterVal).trim();

                    return (
                      <div
                        key={f}
                        className={`p-3 rounded-xl border space-y-1.5 ${
                          isChanged ? 'bg-zinc-900 border-amber-500/40' : 'bg-zinc-900/40 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-300 capitalize">{f}</span>
                          {isChanged ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                              MODIFIED
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Unchanged</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 rounded bg-zinc-950 font-mono text-[11px] text-zinc-400">
                            <span className="text-[9px] uppercase text-zinc-500 block mb-0.5">
                              Previous Version (v{requirement.currentVersion - 1})
                            </span>
                            {beforeVal}
                          </div>
                          <div
                            className={`p-2 rounded bg-zinc-950 font-mono text-[11px] ${
                              isChanged ? 'text-amber-300 border border-amber-500/30' : 'text-zinc-400'
                            }`}
                          >
                            <span className="text-[9px] uppercase text-zinc-500 block mb-0.5">
                              Current Revision (v{requirement.currentVersion})
                            </span>
                            {afterVal}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setIsDiffOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
              >
                Close Diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Problematic Dependencies Warning Dialog */}
      {showDepWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-amber-500/50 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Dependency Warning</h3>
                <p className="text-xs text-amber-300/80">Non-Viable Upstream Dependencies</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This requirement depends on specifications that are currently marked as{' '}
              <strong className="text-red-400">REJECTED</strong> or{' '}
              <strong className="text-amber-400">DEPRECATED</strong>. Approving this requirement may lead to broken upstream assumptions:
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg bg-zinc-900/80 border border-zinc-800 p-3">
              {problematicDependencies.map((dep: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-blue-400">
                      {dep.toRequirement?.code || `REQ-${dep.toRequirementId}`}
                    </span>
                    <span className="text-zinc-300 truncate max-w-[200px]">
                      {dep.toRequirement?.title || 'Unknown specification'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      dep.toRequirement?.workflowStatus === 'REJECTED'
                        ? 'bg-red-950 text-red-400 border border-red-800/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {dep.toRequirement?.workflowStatus}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowDepWarningModal(false)}
                className="px-4 py-2 text-xs rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDepWarningModal(false);
                  handleSubmitReview(undefined, true);
                }}
                className="px-4 py-2 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
              >
                Approve Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

