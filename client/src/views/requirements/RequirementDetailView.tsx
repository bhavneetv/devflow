import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Edit3,
  MoreHorizontal,
  History,
  MessageSquare,
  CheckSquare,
  Layers,
  Calendar,
  Shield,
  User,
  Users,
  ChevronRight,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  GitCommit,
  Split,
  Eye,
  Check,
  AlertTriangle,
  Pin,
  Send,
  Download,
  Copy,
  Archive,
  Info,
  Sliders,
  HelpCircle,
  Sparkles,
  Network,
  GitBranch,
} from 'lucide-react';
import {
  requirementService,
  RequirementType,
  RequirementPriority,
  RequirementWorkflowStatus,
  RequirementImplementationStatus,
  RequirementCategory,
} from '../../services/requirement.service';
import {
  WorkflowStatusBadge,
  PriorityBadge,
  ImplementationStatusBadge,
  RequirementTypeBadge,
} from '../../components/requirements/RequirementBadges';
import { RichTextViewer, RichTextEditor } from '../../components/requirements/RichTextEditor';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { can } from '../../services/requirementPermissions.service';

export const RequirementDetailView: React.FC = () => {
  const { id: routeProjectId, reqId } = useParams<{ id?: string; reqId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization, currentRole } = useOrganization();

  // Target requirement ID could come from reqId or routeProjectId depending on route pattern
  const activeReqId = reqId || routeProjectId;

  // Tabs: overview | criteria | tasks | tests | dependencies | history | discussion
  const [activeTab, setActiveTab] = useState<
    'overview' | 'criteria' | 'tasks' | 'tests' | 'dependencies' | 'history' | 'discussion'
  >('overview');

  // Requirement Data
  const [requirement, setRequirement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dependencies State
  const [dependenciesData, setDependenciesData] = useState<{ outgoing: any[]; incoming: any[] }>({
    outgoing: [],
    incoming: [],
  });
  const [isAddDepModalOpen, setIsAddDepModalOpen] = useState(false);
  const [depTargetReqId, setDepTargetReqId] = useState('');
  const [depType, setDepType] = useState('DEPENDS_ON');
  const [depError, setDepError] = useState<string | null>(null);
  const [isAddingDep, setIsAddingDep] = useState(false);
  const [projectRequirements, setProjectRequirements] = useState<any[]>([]);


  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showImplementedImpactWarning, setShowImplementedImpactWarning] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [changeReason, setChangeReason] = useState('');
  const [requireReReview, setRequireReReview] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Categories & Metadata
  const [categories, setCategories] = useState<RequirementCategory[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);

  // Acceptance Criteria Inline Add State
  const [newCriterionDesc, setNewCriterionDesc] = useState('');
  const [newCriterionMethod, setNewCriterionMethod] = useState('Automated Test');
  const [isAddingCriterion, setIsAddingCriterion] = useState(false);

  // Discussion State
  const [newCommentBody, setNewCommentBody] = useState('');
  const [selectedVersionForComment, setSelectedVersionForComment] = useState<string>('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Version Comparison State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [isConflictDiff, setIsConflictDiff] = useState(false);
  const [versionA, setVersionA] = useState<number>(1);
  const [versionB, setVersionB] = useState<number>(1);
  const [viewSnapshotVersion, setViewSnapshotVersion] = useState<any | null>(null);

  // Dropdown menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // User permission context
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

  // Load Requirement Data
  const loadRequirement = useCallback(async () => {
    if (!activeReqId) return;
    try {
      setIsRefreshing(true);
      const res = await requirementService.getRequirementById(activeReqId);
      if (res.success && res.data) {
        setRequirement(res.data);
        setErrorMessage(null);
      } else {
        setErrorMessage(res.error || 'Requirement not found');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch requirement');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeReqId]);

  useEffect(() => {
    loadRequirement();
  }, [loadRequirement]);

  // Load Dependencies & Project Requirements List
  const loadDependencies = useCallback(async () => {
    if (!requirement?.id) return;
    try {
      const depRes = await requirementService.getDependencies(requirement.id);
      if (depRes.success && depRes.data) {
        setDependenciesData(depRes.data);
      }

      if (requirement.projectId) {
        const listRes = await requirementService.getRequirements({ projectId: requirement.projectId });
        if (listRes.success && listRes.data) {
          setProjectRequirements(
            listRes.data.items.filter((r) => r.id !== requirement.id)
          );
        }
      }
    } catch (err) {
      console.error('Failed to load dependencies', err);
    }
  }, [requirement?.id, requirement?.projectId]);

  useEffect(() => {
    if (requirement?.id) {
      loadDependencies();
    }
  }, [requirement?.id, loadDependencies]);

  // Handle Add Dependency
  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirement || !depTargetReqId) return;
    setDepError(null);
    setIsAddingDep(true);

    try {
      const res = await requirementService.addDependency(requirement.id, {
        targetRequirementId: depTargetReqId,
        type: depType,
      });

      if (res.success) {
        setIsAddDepModalOpen(false);
        setDepTargetReqId('');
        loadDependencies();
        loadRequirement();
      } else {
        setDepError(res.error || 'Failed to link dependency');
      }
    } catch (err: any) {
      setDepError(err.message || 'Error linking dependency');
    } finally {
      setIsAddingDep(false);
    }
  };

  // Handle Delete Dependency
  const handleDeleteDependency = async (dependencyId: number) => {
    if (!requirement) return;
    try {
      const res = await requirementService.deleteDependency(requirement.id, dependencyId);
      if (res.success) {
        loadDependencies();
        loadRequirement();
      }
    } catch (err) {
      console.error('Failed to delete dependency', err);
    }
  };


  // Permission Checks
  const canEdit = useMemo(() => {
    if (!userContext || !requirement) return false;
    const resource = {
      id: requirement.id,
      code: requirement.code,
      projectId: requirement.projectId,
      authorId: requirement.authorId,
      reviewerId: requirement.reviewerId,
      workflowStatus: requirement.workflowStatus,
    };
    if (requirement.workflowStatus === 'APPROVED') {
      return can(userContext, 'edit_approved', resource).allowed;
    }
    return can(userContext, 'edit_own_draft', resource).allowed;
  }, [userContext, requirement]);

  const canSubmit = useMemo(() => {
    if (!userContext || !requirement) return false;
    if (
      requirement.workflowStatus !== 'DRAFT' &&
      requirement.workflowStatus !== 'CHANGES_REQUESTED'
    ) {
      return false;
    }
    const resource = {
      id: requirement.id,
      code: requirement.code,
      projectId: requirement.projectId,
      authorId: requirement.authorId,
      reviewerId: requirement.reviewerId,
      workflowStatus: requirement.workflowStatus,
    };
    return can(userContext, 'submit_for_review', resource).allowed;
  }, [userContext, requirement]);

  const canReview = useMemo(() => {
    if (!userContext || !requirement) return false;
    if (requirement.workflowStatus !== 'PENDING_REVIEW') return false;
    const resource = {
      id: requirement.id,
      code: requirement.code,
      projectId: requirement.projectId,
      authorId: requirement.authorId,
      reviewerId: requirement.reviewerId,
      workflowStatus: requirement.workflowStatus,
    };
    return can(userContext, 'review', resource).allowed;
  }, [userContext, requirement]);

  // Handle Criterion Toggle
  const handleToggleCriterion = async (criterionId: number) => {
    if (!requirement) return;
    try {
      const res = await requirementService.toggleCriterion(requirement.id, criterionId);
      if (res.success && res.data) {
        setRequirement((prev: any) => ({
          ...prev,
          acceptanceCriteria: prev.acceptanceCriteria.map((ac: any) =>
            ac.id === criterionId ? { ...ac, isComplete: res.data.isComplete } : ac
          ),
        }));
      }
    } catch (err) {
      console.error('Failed to toggle criterion', err);
    }
  };

  // Handle Add Criterion
  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterionDesc.trim() || !requirement) return;
    setIsAddingCriterion(true);
    try {
      const res = await requirementService.addCriterion(requirement.id, {
        description: newCriterionDesc.trim(),
        verificationMethod: newCriterionMethod,
      });
      if (res.success && res.data) {
        setRequirement((prev: any) => ({
          ...prev,
          acceptanceCriteria: [...(prev.acceptanceCriteria || []), res.data],
        }));
        setNewCriterionDesc('');
      }
    } catch (err) {
      console.error('Failed to add criterion', err);
    } finally {
      setIsAddingCriterion(false);
    }
  };

  // Handle Delete Criterion
  const handleDeleteCriterion = async (criterionId: number) => {
    if (!requirement) return;
    try {
      const res = await requirementService.deleteCriterion(requirement.id, criterionId);
      if (res.success) {
        setRequirement((prev: any) => ({
          ...prev,
          acceptanceCriteria: prev.acceptanceCriteria.filter((ac: any) => ac.id !== criterionId),
        }));
      }
    } catch (err) {
      console.error('Failed to delete criterion', err);
    }
  };

  // Handle Submit for Review
  const handleSubmitForReview = async () => {
    if (!requirement) return;
    if (requirement.acceptanceCriteria?.length === 0) {
      alert('Cannot submit for review: at least one acceptance criterion is required.');
      return;
    }
    try {
      const res = await requirementService.submitForReview(requirement.id);
      if (res.success) {
        loadRequirement();
      } else {
        alert(res.error || 'Failed to submit requirement');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting requirement');
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim() || !requirement) return;
    setIsPostingComment(true);
    try {
      const res = await requirementService.addComment(requirement.id, {
        body: newCommentBody.trim(),
        versionId: selectedVersionForComment ? parseInt(selectedVersionForComment, 10) : null,
        authorId: user?.id,
      });
      if (res.success && res.data) {
        setRequirement((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), res.data],
        }));
        setNewCommentBody('');
        setSelectedVersionForComment('');
      }
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setIsPostingComment(false);
    }
  };

  // Handle Resolve Comment
  const handleResolveComment = async (commentId: number) => {
    if (!requirement) return;
    try {
      const res = await requirementService.resolveComment(requirement.id, commentId);
      if (res.success && res.data) {
        setRequirement((prev: any) => ({
          ...prev,
          comments: prev.comments.map((c: any) =>
            c.id === commentId ? { ...c, resolvedAt: res.data.resolvedAt } : c
          ),
        }));
      }
    } catch (err) {
      console.error('Failed to resolve comment', err);
    }
  };

  // Open Edit Modal
  const openEditModal = (skipWarning: boolean | React.MouseEvent = false) => {
    if (!requirement) return;
    const isForce = typeof skipWarning === 'boolean' ? skipWarning : false;
    if (!isForce && requirement.implementationStatus === 'IMPLEMENTED') {
      setShowImplementedImpactWarning(true);
      return;
    }
    setEditFormData({
      title: requirement.title || '',
      summary: requirement.summary || '',
      description: requirement.description || '',
      type: requirement.type || 'FUNCTIONAL',
      categoryId: requirement.categoryId || '',
      priority: requirement.priority || 'MEDIUM',
      implementationStatus: requirement.implementationStatus || 'NOT_STARTED',
      expectedBehavior: requirement.expectedBehavior || '',
      preconditions: requirement.preconditions || '',
      constraints: requirement.constraints || '',
      dependencies: requirement.dependencies || '',
      businessJustification: requirement.businessJustification || '',
      referenceLinks: requirement.referenceLinks || '',
      targetDate: requirement.targetDate ? requirement.targetDate.split('T')[0] : '',
      riskLevel: requirement.riskLevel || 'LOW',
      complexity: requirement.complexity || 'LOW',
      reviewerId: requirement.reviewerId || '',
      responsibleMemberId: requirement.responsibleMemberId || '',
    });
    setChangeReason('');
    setRequireReReview(false);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Save Edit (Rule 5 Compliant & Optimistic Concurrency Conflict Guard)
  const handleSaveEdit = async (e?: React.FormEvent, forceOverwrite = false) => {
    if (e) e.preventDefault();
    if (!requirement) return;
    setEditError(null);

    // Rule 5: If currently APPROVED, change reason is required
    const isApproved = requirement.workflowStatus === 'APPROVED';
    if (isApproved && !changeReason.trim()) {
      setEditError('Rule 5 Governance: A change reason is required when modifying an approved requirement.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const payload: any = {
        ...editFormData,
        currentVersion: requirement.currentVersion,
        forceOverwrite: forceOverwrite ? true : undefined,
        categoryId: editFormData.categoryId ? parseInt(editFormData.categoryId, 10) : null,
        reviewerId: editFormData.reviewerId ? parseInt(editFormData.reviewerId, 10) : null,
        responsibleMemberId: editFormData.responsibleMemberId
          ? parseInt(editFormData.responsibleMemberId, 10)
          : null,
        targetDate: editFormData.targetDate ? editFormData.targetDate : null,
        changeReason: changeReason.trim() || undefined,
        requireReReview,
      };

      const res = await requirementService.updateRequirement(requirement.id, payload);
      if (res.success) {
        setIsEditModalOpen(false);
        setIsConflictDiff(false);
        setCompareModalOpen(false);
        loadRequirement();
      } else if (
        res.code === 'VERSION_CONFLICT' ||
        res.status === 409 ||
        (res.error && res.error.includes('Conflicting edit'))
      ) {
        // Open Compare Versions diff modal with conflict banner & [Overwrite] [Cancel]
        setIsConflictDiff(true);
        if (res.serverVersion) {
          setVersionA(requirement.currentVersion);
          setVersionB(res.serverVersion);
        }
        setIsEditModalOpen(false);
        setCompareModalOpen(true);
      } else {
        setEditError(res.error || 'Failed to save changes');
      }
    } catch (err: any) {
      setEditError(err.message || 'Error saving changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Calculations
  const criteriaProgress = useMemo(() => {
    if (!requirement?.acceptanceCriteria || requirement.acceptanceCriteria.length === 0) {
      return { total: 0, completed: 0, percent: 0 };
    }
    const total = requirement.acceptanceCriteria.length;
    const completed = requirement.acceptanceCriteria.filter((ac: any) => ac.isComplete).length;
    return {
      total,
      completed,
      percent: Math.round((completed / total) * 100),
    };
  }, [requirement]);

  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 space-y-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-zinc-800" />
          <div className="h-6 w-48 rounded bg-zinc-800" />
        </div>
        <div className="h-14 w-full rounded-xl bg-zinc-900 animate-pulse border border-zinc-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
          <div className="h-96 rounded-xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
        </div>
      </div>
    );
  }

  // Error State
  if (errorMessage || !requirement) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 p-8 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Requirement Not Found</h2>
        <p className="text-sm text-zinc-400 max-w-md text-center mb-6">
          {errorMessage || 'The requested requirement does not exist or you lack permission to view it.'}
        </p>
        <button
          onClick={() => navigate('/requirements')}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back to Requirements
        </button>
      </div>
    );
  }

  // Versions available for comparison
  const versionsList = requirement.versions || [];

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="border-b border-[#27272A] bg-[#0E0E10] px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          {/* Breadcrumb Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link
                to="/requirements"
                className="hover:text-zinc-200 transition-colors flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Requirements
              </Link>
              <ChevronRight size={13} className="text-zinc-600" />
              {requirement.project ? (
                <Link
                  to={`/projects/${requirement.project.id}/requirements`}
                  className="hover:text-zinc-200 transition-colors font-medium text-zinc-300"
                >
                  {requirement.project.title}
                </Link>
              ) : (
                <span>Global Workspace</span>
              )}
              <ChevronRight size={13} className="text-zinc-600" />
              <span className="font-mono text-blue-400 font-semibold">{requirement.code}</span>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-2.5">
              {/* Submit for Review Button */}
              {canSubmit && (
                <button
                  onClick={handleSubmitForReview}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Clock size={13} /> Submit for Review
                </button>
              )}

              {/* Review Button */}
              {canReview && (
                <button
                  onClick={() => navigate(`/projects/${requirement.projectId}/requirements/${requirement.id}/review`)}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={13} /> Conduct Review
                </button>
              )}

              {/* Edit Button (Authorized Only) */}
              {canEdit && (
                <button
                  onClick={openEditModal}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Edit3 size={13} /> Edit Specification
                </button>
              )}

              {/* Overflow Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors"
                >
                  <MoreHorizontal size={15} />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-[#161619] border border-zinc-700 shadow-xl py-1 z-50 text-xs">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.print();
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                    >
                      <Download size={13} /> Export / Print
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigator.clipboard.writeText(window.location.href);
                        alert('Link copied to clipboard!');
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                    >
                      <Copy size={13} /> Copy Link
                    </button>
                    <div className="border-t border-zinc-800 my-1" />
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (confirm('Archive this specification?')) {
                          requirementService.updateRequirement(requirement.id, {
                            workflowStatus: 'ARCHIVED',
                          }).then(() => loadRequirement());
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <Archive size={13} /> Archive Requirement
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title & Badges Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                  {requirement.code}
                </span>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                  {requirement.title}
                </h1>
              </div>

              {requirement.summary && (
                <p className="text-xs md:text-sm text-zinc-400 max-w-3xl">
                  {requirement.summary}
                </p>
              )}
            </div>

            {/* Badges Cluster */}
            <div className="flex flex-wrap items-center gap-2">
              <WorkflowStatusBadge status={requirement.workflowStatus} />
              <ImplementationStatusBadge status={requirement.implementationStatus} />
              <PriorityBadge priority={requirement.priority} />
              <RequirementTypeBadge type={requirement.type} />
              <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 border border-zinc-700/80 px-2 py-0.5 rounded">
                v{requirement.currentVersion}
              </span>
            </div>
          </div>

          {/* Rule 5 Notice if Approved */}
          {requirement.workflowStatus === 'APPROVED' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs">
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              <span>
                <strong>Approved Specification.</strong> Any subsequent modification will create a new version (Rule 5) to safeguard audit traceability.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. TAB NAVIGATION BAR */}
      <div className="border-b border-[#27272A] bg-[#0A0A0C] px-6 sticky top-[138px] z-20">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'overview'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <FileText size={14} /> Overview
          </button>

          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'criteria'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <CheckSquare size={14} /> Acceptance Criteria
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 font-mono text-zinc-300 ml-1">
              {criteriaProgress.completed}/{criteriaProgress.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'tasks'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Layers size={14} /> Linked Tasks
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 font-mono text-zinc-300 ml-1">
              {requirement.links?.filter((l: any) => l.targetType === 'TASK').length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'tests'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Shield size={14} /> Linked Tests
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 text-zinc-500 ml-1">
              QA Off
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dependencies')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'dependencies'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Network size={14} /> Dependencies
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 font-mono text-zinc-300 ml-1">
              {dependenciesData.outgoing.length + dependenciesData.incoming.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'history'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <History size={14} /> Version History
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 font-mono text-zinc-300 ml-1">
              v{requirement.currentVersion}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('discussion')}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'discussion'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <MessageSquare size={14} /> Discussion
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-800 font-mono text-zinc-300 ml-1">
              {requirement.comments?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* 3. TAB CONTENT BODY */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 Cols): Core Specifications */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description Section */}
              <div className="p-6 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText size={16} className="text-blue-400" />
                    Detailed Specification Description
                  </h3>
                  {canEdit && (
                    <button
                      onClick={openEditModal}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                  )}
                </div>

                {requirement.description ? (
                  <div className="text-sm text-zinc-300 leading-relaxed font-sans">
                    <RichTextViewer content={requirement.description} />
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 italic py-4 text-center">
                    No detailed description provided for this specification.
                  </div>
                )}
              </div>

              {/* Behavior & Constraints Accordion / Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expected Behavior */}
                <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" /> Expected Behavior
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {requirement.expectedBehavior || (
                      <span className="text-zinc-600 italic">None specified</span>
                    )}
                  </p>
                </div>

                {/* Business Justification */}
                <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Info size={14} className="text-blue-400" /> Business Justification
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {requirement.businessJustification || (
                      <span className="text-zinc-600 italic">None specified</span>
                    )}
                  </p>
                </div>

                {/* Preconditions */}
                <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Clock size={14} className="text-emerald-400" /> Preconditions
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {requirement.preconditions || (
                      <span className="text-zinc-600 italic">None specified</span>
                    )}
                  </p>
                </div>

                {/* Constraints */}
                <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-rose-400" /> Constraints
                  </span>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {requirement.constraints || (
                      <span className="text-zinc-600 italic">None specified</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Technical Dependencies & Reference Links */}
              <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Layers size={14} className="text-purple-400" /> Dependencies & Architecture References
                </span>
                <div className="text-xs text-zinc-400 leading-relaxed">
                  {requirement.dependencies ? (
                    <div className="p-2.5 rounded bg-zinc-900/60 font-mono text-[11px] text-zinc-300 border border-zinc-800">
                      {requirement.dependencies}
                    </div>
                  ) : (
                    <span className="text-zinc-600 italic">No dependencies noted</span>
                  )}
                </div>

                {requirement.referenceLinks && (
                  <div className="pt-2 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-400">
                    <ExternalLink size={13} className="text-blue-400" />
                    <span className="text-zinc-500">References:</span>
                    <a
                      href={requirement.referenceLinks}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline truncate max-w-md"
                    >
                      {requirement.referenceLinks}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (1 Col): Responsibility, Impact & Metadata */}
            <div className="space-y-6">
              {/* Responsibility Card */}
              <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Responsibility & Review
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Author */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Author</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[9px]">
                        {requirement.author?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-zinc-200 font-medium">{requirement.author?.name}</span>
                    </div>
                  </div>

                  {/* Designated Reviewer */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Reviewer</span>
                    {requirement.reviewer ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-[9px]">
                          {requirement.reviewer.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-zinc-200 font-medium">
                          {requirement.reviewer.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-600 italic">Unassigned</span>
                    )}
                  </div>

                  {/* Responsible Team */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Team</span>
                    {requirement.responsibleTeam ? (
                      <span className="px-2 py-0.5 rounded text-[11px] bg-zinc-800 text-zinc-300 font-medium">
                        {requirement.responsibleTeam.name}
                      </span>
                    ) : (
                      <span className="text-zinc-600 italic">None</span>
                    )}
                  </div>

                  {/* Category */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Category</span>
                    {requirement.category ? (
                      <span className="text-zinc-200 font-medium">
                        {requirement.category.name}
                      </span>
                    ) : (
                      <span className="text-zinc-600 italic">General</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Assessment Metrics */}
              <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Impact & Scheduling
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Target Date</span>
                    <span className="font-mono font-medium text-zinc-200">
                      {requirement.targetDate
                        ? new Date(requirement.targetDate).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Risk Level</span>
                    <span
                      className={`font-semibold text-[11px] ${requirement.riskLevel === 'CRITICAL'
                          ? 'text-red-400'
                          : requirement.riskLevel === 'HIGH'
                            ? 'text-orange-400'
                            : requirement.riskLevel === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-zinc-400'
                        }`}
                    >
                      {requirement.riskLevel || 'LOW'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Complexity</span>
                    <span className="font-semibold text-[11px] text-zinc-300">
                      {requirement.complexity || 'LOW'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Business Impact</span>
                    <span className="font-semibold text-[11px] text-zinc-300">
                      {requirement.businessImpact || 'MEDIUM'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Work Breakdown Counters */}
              <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Traceability Coverage
                </h4>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div
                    onClick={() => setActiveTab('criteria')}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <span className="block font-mono text-base font-bold text-blue-400">
                      {criteriaProgress.total}
                    </span>
                    <span className="text-[10px] text-zinc-500">Criteria</span>
                  </div>

                  <div
                    onClick={() => setActiveTab('tasks')}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <span className="block font-mono text-base font-bold text-purple-400">
                      {requirement.links?.filter((l: any) => l.targetType === 'TASK').length || 0}
                    </span>
                    <span className="text-[10px] text-zinc-500">Tasks</span>
                  </div>

                  <div
                    onClick={() => setActiveTab('history')}
                    className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <span className="block font-mono text-base font-bold text-emerald-400">
                      v{requirement.currentVersion}
                    </span>
                    <span className="text-[10px] text-zinc-500">Revisions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ACCEPTANCE CRITERIA ================= */}
        {activeTab === 'criteria' && (
          <div className="space-y-6">
            {/* Progress Header Card */}
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckSquare size={16} className="text-blue-400" />
                  Acceptance Criteria Verification Checklist
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Conditions and behavior required for this specification to be considered complete and verified.
                </p>
              </div>

              {/* Progress Bar & Counter */}
              <div className="w-full md:w-64 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Progress</span>
                  <span className="font-mono font-semibold text-zinc-200">
                    {criteriaProgress.completed} of {criteriaProgress.total} ({criteriaProgress.percent}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${criteriaProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
              {(!requirement.acceptanceCriteria || requirement.acceptanceCriteria.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <AlertCircle size={28} className="mx-auto text-amber-400" />
                  <p className="text-sm font-medium text-zinc-200">No acceptance criteria defined yet.</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    A specification must have at least one criterion before it can be submitted for review.
                  </p>
                </div>
              ) : (
                requirement.acceptanceCriteria.map((ac: any) => (
                  <div
                    key={ac.id}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 ${ac.isComplete
                        ? 'bg-emerald-950/10 border-emerald-500/20'
                        : 'bg-[#0E0E10] border-[#27272A] hover:border-zinc-700'
                      }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => handleToggleCriterion(ac.id)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-colors ${ac.isComplete
                            ? 'bg-emerald-500 border-emerald-500 text-zinc-950 font-bold'
                            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60'
                          }`}
                      >
                        {ac.isComplete && <Check size={13} strokeWidth={3} />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            {ac.code}
                          </span>
                          {ac.verificationMethod && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                              {ac.verificationMethod}
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-xs md:text-sm leading-relaxed ${ac.isComplete ? 'line-through text-zinc-500' : 'text-zinc-200'
                            }`}
                        >
                          {ac.description}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        onClick={() => handleDeleteCriterion(ac.id)}
                        className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                        title="Delete criterion"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Inline Add Form (Authorized Only) */}
            {canEdit && (
              <form
                onSubmit={handleAddCriterion}
                className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Plus size={14} className="text-blue-400" />
                  <span>Add Acceptance Criterion</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      placeholder="Given [precondition], when [action], then [outcome]..."
                      value={newCriterionDesc}
                      onChange={(e) => setNewCriterionDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <select
                      value={newCriterionMethod}
                      onChange={(e) => setNewCriterionMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Automated Test">Automated Test</option>
                      <option value="Manual Verification">Manual Verification</option>
                      <option value="Code Inspection">Code Inspection</option>
                      <option value="Security Audit">Security Audit</option>
                      <option value="Performance Benchmark">Performance Benchmark</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAddingCriterion || !newCriterionDesc.trim()}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Plus size={13} /> Add Criterion
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ================= TAB 3: LINKED TASKS (RULE 9) ================= */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers size={16} className="text-purple-400" />
                  Implementation Tasks Breakdown
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Traceability links to execution tasks in Task Management.
                </p>
              </div>

              <button
                disabled
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 text-xs font-medium cursor-not-allowed flex items-center gap-1.5"
                title="Task Management module will be linked when tasks are connected."
              >
                <Plus size={13} /> Create Linked Task
              </button>
            </div>

            {/* Check for REAL linked tasks (Rule 9) */}
            {requirement.links &&
              requirement.links.filter((l: any) => l.targetType === 'TASK' && l.task).length > 0 ? (
              <div className="rounded-xl border border-[#27272A] overflow-hidden bg-[#0E0E10]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121214] text-zinc-400 border-b border-[#27272A]">
                    <tr>
                      <th className="py-3 px-4">Task ID</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {requirement.links
                      .filter((l: any) => l.targetType === 'TASK' && l.task)
                      .map((l: any) => (
                        <tr key={l.id} className="hover:bg-zinc-900/40">
                          <td className="py-3 px-4 font-mono text-purple-400">
                            TASK-{l.task.id}
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-200">
                            {l.task.title}
                          </td>
                          <td className="py-3 px-4 text-zinc-400">{l.task.priority}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 font-mono">
                              {l.task.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Clean, styled placeholder card (Rule 9: Never fake links) */
              <div className="p-10 rounded-xl bg-[#0E0E10] border border-[#27272A] text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                  <Layers size={24} />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h4 className="text-sm font-semibold text-zinc-200">
                    Task Management Module Connection
                  </h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Tasks will appear here once tasks are linked from the Task Management system.
                    DevFlow strictly adheres to Rule 9: no mock or fabricated task items are generated.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-500">
                  <Info size={13} />
                  <span>Connect an existing task via task reference ID or Task board</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: LINKED TESTS (QA PLACEHOLDER) ================= */}
        {activeTab === 'tests' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Shield size={16} className="text-emerald-400" />
                  QA Verification & Automated Test Runs
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Automated test suites, manual QA cases, and defect trace matrices.
                </p>
              </div>
            </div>

            {/* QA Module Placeholder (Rule 9) */}
            <div className="p-10 rounded-xl bg-[#0E0E10] border border-[#27272A] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Shield size={24} />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-sm font-semibold text-zinc-200">
                  QA & Test Management Integration Pending
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Test cases, automated test runner telemetry, and defect tracking reports will populate here once the DevFlow QA module is connected.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-500">
                <Info size={13} />
                <span>Criteria are mapped to test identifiers automatically upon test runner registration</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: DEPENDENCIES & GRAPH ================= */}
        {activeTab === 'dependencies' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Network size={16} className="text-blue-400" />
                  Specification Dependency Relationships & Ordering Graph
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Circular dependency detection prevents cyclic deadlocks across ordering types (DEPENDS_ON, BLOCKS).
                </p>
              </div>

              {canEdit && (
                <button
                  onClick={() => {
                    setDepError(null);
                    setDepTargetReqId('');
                    setDepType('DEPENDS_ON');
                    setIsAddDepModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus size={13} /> Link Dependency
                </button>
              )}
            </div>

            {/* VISUAL DEPENDENCY GRAPH WIDGET */}
            <div className="p-6 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-4">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Visual Flow Hierarchy
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* 1. Upstream (Prerequisites) */}
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3 min-h-[140px]">
                  <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={13} /> Upstream (Prerequisites)
                  </div>
                  {dependenciesData.outgoing.filter((d: any) => d.type === 'DEPENDS_ON').length === 0 &&
                    dependenciesData.incoming.filter((d: any) => d.type === 'BLOCKS').length === 0 ? (
                    <div className="text-[11px] text-zinc-500 italic py-4 text-center">
                      No prerequisite dependencies.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dependenciesData.outgoing
                        .filter((d: any) => d.type === 'DEPENDS_ON')
                        .map((d: any) => (
                          <div
                            key={d.id}
                            onClick={() =>
                              navigate(
                                `/projects/${requirement.projectId}/requirements/${d.toRequirement?.id}`
                              )
                            }
                            className="p-2.5 rounded-lg bg-zinc-950 border border-amber-500/30 hover:border-amber-400 cursor-pointer transition-colors text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold text-amber-400">
                                {d.toRequirement?.code}
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                                REQUIRED
                              </span>
                            </div>
                            <p className="text-zinc-300 truncate text-[11px]">
                              {d.toRequirement?.title}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 2. Current Specification Node */}
                <div className="p-4 rounded-xl bg-blue-950/20 border-2 border-blue-500/50 space-y-2 text-center shadow-lg relative">
                  <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                    Current Specification
                  </span>
                  <div className="font-mono text-sm font-bold text-white">{requirement.code}</div>
                  <p className="text-xs text-zinc-300 font-medium line-clamp-2">
                    {requirement.title}
                  </p>
                  <div className="pt-1 flex justify-center">
                    <WorkflowStatusBadge status={requirement.workflowStatus} />
                  </div>
                </div>

                {/* 3. Downstream (Blocked / Dependents) */}
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3 min-h-[140px]">
                  <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={13} /> Downstream (Dependents)
                  </div>
                  {dependenciesData.outgoing.filter((d: any) => d.type === 'BLOCKS').length === 0 &&
                    dependenciesData.incoming.filter((d: any) => d.type === 'DEPENDS_ON').length === 0 ? (
                    <div className="text-[11px] text-zinc-500 italic py-4 text-center">
                      No downstream dependents.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dependenciesData.outgoing
                        .filter((d: any) => d.type === 'BLOCKS')
                        .map((d: any) => (
                          <div
                            key={d.id}
                            onClick={() =>
                              navigate(
                                `/projects/${requirement.projectId}/requirements/${d.toRequirement?.id}`
                              )
                            }
                            className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/30 hover:border-purple-400 cursor-pointer transition-colors text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] font-bold text-purple-400">
                                {d.toRequirement?.code}
                              </span>
                              <span className="text-[9px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                                BLOCKED
                              </span>
                            </div>
                            <p className="text-zinc-300 truncate text-[11px]">
                              {d.toRequirement?.title}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DEPENDENCY LIST TABLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                All Linked Relationships (
                {dependenciesData.outgoing.length + dependenciesData.incoming.length})
              </h4>

              {dependenciesData.outgoing.length === 0 && dependenciesData.incoming.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#0E0E10] border border-[#27272A] text-zinc-500 text-xs">
                  No dependencies linked yet. Click "+ Link Dependency" to define architectural ordering.
                </div>
              ) : (
                <div className="rounded-xl border border-[#27272A] overflow-hidden bg-[#0E0E10]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#121214] text-zinc-400 border-b border-[#27272A]">
                      <tr>
                        <th className="py-3 px-4">Relationship</th>
                        <th className="py-3 px-4">Target Requirement</th>
                        <th className="py-3 px-4">Status</th>
                        {canEdit && <th className="py-3 px-4 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {dependenciesData.outgoing.map((dep: any) => (
                        <tr key={`out-${dep.id}`} className="hover:bg-zinc-900/40">
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              This {dep.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/projects/${requirement.projectId}/requirements/${dep.toRequirement?.id}`}
                              className="font-medium text-zinc-200 hover:text-blue-400 flex items-center gap-1.5"
                            >
                              <span className="font-mono text-blue-400">{dep.toRequirement?.code}</span>
                              <span>— {dep.toRequirement?.title}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <WorkflowStatusBadge status={dep.toRequirement?.workflowStatus} />
                          </td>
                          {canEdit && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteDependency(dep.id)}
                                className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                                title="Remove dependency"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {dependenciesData.incoming.map((dep: any) => (
                        <tr key={`in-${dep.id}`} className="hover:bg-zinc-900/40">
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {dep.type === 'DEPENDS_ON'
                                ? 'Depended on by'
                                : dep.type === 'BLOCKS'
                                  ? 'Blocked by'
                                  : dep.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              to={`/projects/${requirement.projectId}/requirements/${dep.fromRequirement?.id}`}
                              className="font-medium text-zinc-200 hover:text-blue-400 flex items-center gap-1.5"
                            >
                              <span className="font-mono text-purple-400">{dep.fromRequirement?.code}</span>
                              <span>— {dep.fromRequirement?.title}</span>
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <WorkflowStatusBadge status={dep.fromRequirement?.workflowStatus} />
                          </td>
                          {canEdit && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteDependency(dep.id)}
                                className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                                title="Remove dependency"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ================= TAB 5: VERSION HISTORY & DIFF (RULE 5) ================= */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <History size={16} className="text-blue-400" />
                  Specification Revisions & Audit History
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Every revision of an approved requirement is permanently snapshotted in compliance with Rule 5.
                </p>
              </div>

              {versionsList.length >= 2 && (
                <button
                  onClick={() => {
                    setVersionA(1);
                    setVersionB(requirement.currentVersion);
                    setCompareModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                >
                  <Split size={14} /> Compare Revisions (Diff)
                </button>
              )}
            </div>

            {/* Version Timeline */}
            <div className="space-y-4">
              {versionsList.map((ver: any, index: number) => {
                let snapshotObj: any = null;
                try {
                  snapshotObj = JSON.parse(ver.snapshot);
                } catch (e) {
                  snapshotObj = null;
                }

                const isCurrent = ver.versionNumber === requirement.currentVersion;

                return (
                  <div
                    key={ver.id || index}
                    className={`p-5 rounded-xl border transition-all ${isCurrent
                        ? 'bg-blue-950/10 border-blue-500/30'
                        : 'bg-[#0E0E10] border-[#27272A] hover:border-zinc-700'
                      }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded">
                          v{ver.versionNumber}
                        </span>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-200">
                              {ver.changedBy?.name || 'DevFlow System'}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-blue-500 text-zinc-950 font-bold px-1.5 py-0.5 rounded">
                                Current Active Version
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(ver.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewSnapshotVersion(ver)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors flex items-center gap-1 border border-zinc-700"
                        >
                          <Eye size={12} /> View Snapshot
                        </button>
                      </div>
                    </div>

                    {/* Change Reason Callout */}
                    <div className="mt-3.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs space-y-1">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">
                        Reason for Change:
                      </span>
                      <p className="text-zinc-300 italic">
                        "{ver.changeReason || 'No change reason recorded'}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 6: DISCUSSION ================= */}
        {activeTab === 'discussion' && (
          <div className="space-y-6 max-w-4xl">
            <div className="p-5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-400" />
                  Specification Discussion & Clarification
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Threaded comments, resolution checkboxes, and version-specific feedback.
                </p>
              </div>
            </div>

            {/* Comment Form */}
            <form
              onSubmit={handleAddComment}
              className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3"
            >
              <textarea
                rows={3}
                placeholder="Leave a comment or question about this specification..."
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 placeholder:text-zinc-600 resize-none"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500">Referencing:</span>
                  <select
                    value={selectedVersionForComment}
                    onChange={(e) => setSelectedVersionForComment(e.target.value)}
                    className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="">Whole Requirement (All Versions)</option>
                    {versionsList.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        Revision v{v.versionNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isPostingComment || !newCommentBody.trim()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send size={12} /> Post Comment
                </button>
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-3">
              {(!requirement.comments || requirement.comments.length === 0) ? (
                <div className="p-8 text-center rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2">
                  <MessageSquare size={24} className="mx-auto text-zinc-600" />
                  <p className="text-xs text-zinc-400">No comments posted yet.</p>
                </div>
              ) : (
                requirement.comments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${comment.resolvedAt
                        ? 'bg-zinc-900/30 border-zinc-800/60 opacity-75'
                        : 'bg-[#0E0E10] border-[#27272A]'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-[10px]">
                          {comment.author?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">
                          {comment.author?.name || 'Team Member'}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                        {comment.versionId && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-blue-400 font-mono">
                            Ref: Version
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleResolveComment(comment.id)}
                        className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${comment.resolvedAt
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-zinc-500 hover:text-zinc-300 bg-zinc-900'
                          }`}
                      >
                        <Check size={12} />
                        {comment.resolvedAt ? 'Resolved' : 'Mark Resolved'}
                      </button>
                    </div>

                    <p className="text-xs md:text-sm text-zinc-300 leading-relaxed font-sans pl-8">
                      {comment.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Implemented Requirement Impact Warning Modal */}
      {showImplementedImpactWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-amber-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Impact Warning</h3>
                <p className="text-xs text-amber-300/80">Requirement Already Implemented</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">
              This requirement is already implemented — changes may impact development and testing
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowImplementedImpactWarning(false)}
                className="px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowImplementedImpactWarning(false);
                  openEditModal(true);
                }}
                className="px-4 py-2 text-sm rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
              >
                Continue editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. EDIT MODAL (RULE 5 COMPLIANT) ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-zinc-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 size={17} className="text-blue-400" />
                  Edit Requirement: {requirement.code}
                </h3>
                <span className="text-xs text-zinc-400">
                  Current Version: v{requirement.currentVersion} • Status: {requirement.workflowStatus}
                </span>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Rule 5 Warning Banner for Approved Requirements */}
            {requirement.workflowStatus === 'APPROVED' && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <AlertTriangle size={15} />
                  Rule 5 Governance: Editing Approved Requirement
                </div>
                <p className="text-amber-200/80 leading-relaxed">
                  This requirement is <strong>APPROVED</strong>. Saving these modifications will automatically create a new revision (v{requirement.currentVersion + 1}). The existing version will be preserved in version history for audit compliance.
                </p>
              </div>
            )}

            {editError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Title */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Requirement Title *</label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Short Summary</label>
                <input
                  type="text"
                  value={editFormData.summary}
                  onChange={(e) => setEditFormData({ ...editFormData, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 text-xs"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Detailed Description (Rich Text & Markdown)</label>
                <RichTextEditor
                  value={editFormData.description || ''}
                  onChange={(val) => setEditFormData({ ...editFormData, description: val })}
                  rows={5}
                />
              </div>

              {/* Priority & Implementation Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Priority</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Implementation Status</label>
                  <select
                    value={editFormData.implementationStatus}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, implementationStatus: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none"
                  >
                    <option value="NOT_STARTED">NOT_STARTED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="IMPLEMENTED">IMPLEMENTED</option>
                    <option value="VERIFIED">VERIFIED</option>
                  </select>
                </div>
              </div>

              {/* Expected Behavior & Constraints */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Expected Behavior</label>
                  <textarea
                    rows={2}
                    value={editFormData.expectedBehavior}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, expectedBehavior: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Constraints</label>
                  <textarea
                    rows={2}
                    value={editFormData.constraints}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, constraints: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Rule 5: Change Reason (Mandatory if Approved) */}
              {requirement.workflowStatus === 'APPROVED' && (
                <div className="p-3 rounded-xl bg-zinc-900 border border-amber-500/40 space-y-3">
                  <div>
                    <label className="block text-amber-300 font-semibold mb-1">
                      Reason for Revision (v{requirement.currentVersion + 1}) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Updated constraints to support 50k concurrent requests"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0E0E10] border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-zinc-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={requireReReview}
                      onChange={(e) => setRequireReReview(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500"
                    />
                    <span>Require re-review (Transition status back to Pending Review)</span>
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= 5. VERSION COMPARISON MODAL (DIFF VIEW) ================= */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-zinc-700 rounded-2xl max-w-4xl w-full p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Split size={17} className="text-blue-400" />
                  Compare Revisions (Side-by-Side Diff)
                </h3>
                <span className="text-xs text-zinc-400">
                  Audit changes between specification releases
                </span>
              </div>
              <button
                onClick={() => {
                  setCompareModalOpen(false);
                  setIsConflictDiff(false);
                }}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Conflicting Edit Warning Banner */}
            {isConflictDiff && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-semibold text-red-300">
                  <AlertTriangle size={15} />
                  Conflicting Edit Detected (HTTP 409)
                </div>
                <p className="text-red-200/80 leading-relaxed">
                  Another team member has updated this requirement to revision <strong>v{versionB}</strong> while you were editing <strong>v{versionA}</strong>. Review the conflicting differences below. You can overwrite with your changes or cancel to reload the latest revision.
                </p>
              </div>
            )}

            {/* Version Selectors */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Base Version (Left)</label>
                <select
                  value={versionA}
                  onChange={(e) => setVersionA(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0E0E10] border border-zinc-700 text-zinc-200"
                >
                  {versionsList.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      Revision v{v.versionNumber} ({new Date(v.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Comparison Version (Right)</label>
                <select
                  value={versionB}
                  onChange={(e) => setVersionB(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0E0E10] border border-zinc-700 text-zinc-200"
                >
                  {versionsList.map((v: any) => (
                    <option key={v.id} value={v.versionNumber}>
                      Revision v{v.versionNumber} ({new Date(v.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Diff Content */}
            {(() => {
              const snapA = versionsList.find((v: any) => v.versionNumber === versionA);
              const snapB = versionsList.find((v: any) => v.versionNumber === versionB);
              let dataA: any = {};
              let dataB: any = {};
              try {
                if (snapA) dataA = JSON.parse(snapA.snapshot);
                if (snapB) dataB = JSON.parse(snapB.snapshot);
              } catch (e) { }

              const fieldsToCompare = [
                { key: 'title', label: 'Title' },
                { key: 'summary', label: 'Summary' },
                { key: 'priority', label: 'Priority' },
                { key: 'type', label: 'Type' },
                { key: 'description', label: 'Description' },
                { key: 'expectedBehavior', label: 'Expected Behavior' },
                { key: 'constraints', label: 'Constraints' },
              ];

              return (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {fieldsToCompare.map((f) => {
                    const valA = dataA[f.key] || '—';
                    const valB = dataB[f.key] || '—';
                    const isDifferent = String(valA).trim() !== String(valB).trim();

                    return (
                      <div
                        key={f.key}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${isDifferent
                            ? 'bg-zinc-900/60 border-amber-500/40'
                            : 'bg-zinc-900/30 border-zinc-800/60'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-300">{f.label}</span>
                          {isDifferent ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                              MODIFIED
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500">Unchanged</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className={`p-2.5 rounded bg-zinc-950 font-mono text-[11px] leading-relaxed ${isDifferent ? 'border border-red-900/50 text-red-300 bg-red-950/20' : 'text-zinc-400'
                            }`}>
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">
                              v{versionA}
                            </span>
                            {valA}
                          </div>

                          <div className={`p-2.5 rounded bg-zinc-950 font-mono text-[11px] leading-relaxed ${isDifferent ? 'border border-emerald-900/50 text-emerald-300 bg-emerald-950/20' : 'text-zinc-400'
                            }`}>
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">
                              v{versionB}
                            </span>
                            {valB}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              {isConflictDiff ? (
                <>
                  <button
                    onClick={() => {
                      setCompareModalOpen(false);
                      setIsConflictDiff(false);
                      loadRequirement();
                    }}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    Cancel & Discard My Stale Edit
                  </button>
                  <button
                    onClick={() => {
                      handleSaveEdit(undefined as any, true);
                    }}
                    disabled={isSavingEdit}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-red-600/20 transition-colors"
                  >
                    {isSavingEdit ? 'Overwriting...' : 'Overwrite with My Changes'}
                  </button>
                </>
              ) : (
                <div className="ml-auto">
                  <button
                    onClick={() => setCompareModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
                  >
                    Close Comparison
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. SNAPSHOT MODAL (READ-ONLY) ================= */}
      {viewSnapshotVersion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-zinc-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Eye size={17} className="text-blue-400" />
                Snapshot: Revision v{viewSnapshotVersion.versionNumber}
              </h3>
              <button
                onClick={() => setViewSnapshotVersion(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-zinc-400 space-y-1">
              <p>
                <strong>Author:</strong> {viewSnapshotVersion.changedBy?.name || 'System'}
              </p>
              <p>
                <strong>Timestamp:</strong> {new Date(viewSnapshotVersion.createdAt).toLocaleString()}
              </p>
              <p>
                <strong>Reason:</strong> {viewSnapshotVersion.changeReason}
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto p-4 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 border border-zinc-800">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(JSON.parse(viewSnapshotVersion.snapshot), null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <button
                onClick={() => setViewSnapshotVersion(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= 7. LINK DEPENDENCY MODAL (WITH CYCLE PREVENTION) ================= */}
      {isAddDepModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121214] border border-zinc-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Network size={16} className="text-blue-400" />
                  Link Requirement Dependency
                </h3>
                <span className="text-xs text-zinc-400">
                  Establish architectural relationships and ordering
                </span>
              </div>
              <button
                onClick={() => setIsAddDepModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {depError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-400 mt-0.5" />
                <span>{depError}</span>
              </div>
            )}

            <form onSubmit={handleAddDependency} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Relationship Type *
                </label>
                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="DEPENDS_ON">
                    This DEPENDS ON Target (This requires Target first — Order constraint)
                  </option>
                  <option value="BLOCKS">
                    This BLOCKS Target (Target cannot proceed until This is done — Order constraint)
                  </option>
                  <option value="RELATED_TO">
                    RELATED TO (General associative connection)
                  </option>
                  <option value="ENHANCES">
                    ENHANCES (Extends or improves target specification)
                  </option>
                  <option value="CONFLICTS_WITH">
                    CONFLICTS WITH (Mutually exclusive architecture or scope)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Target Requirement *
                </label>
                {projectRequirements.length === 0 ? (
                  <p className="text-zinc-500 italic">No other requirements in this project.</p>
                ) : (
                  <select
                    required
                    value={depTargetReqId}
                    onChange={(e) => setDepTargetReqId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select a requirement...</option>
                    {projectRequirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.title} ({r.workflowStatus})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-[11px] text-blue-300 space-y-1">
                <strong>Cycle Detection Engine:</strong>
                <p className="text-zinc-400">
                  DevFlow verifies directed graphs via DFS traversal. Any cycle (A → B → A) for ordering types will be strictly rejected.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddDepModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingDep || !depTargetReqId}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-colors"
                >
                  {isAddingDep ? 'Verifying Graph...' : 'Create Dependency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

