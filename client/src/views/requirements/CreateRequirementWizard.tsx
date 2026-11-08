import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  Zap,
  Shield,
  Briefcase,
  Cpu,
  Gauge,
  Smile,
  CheckCircle,
  Network,
  AlertTriangle,
  Plus,
  Trash2,
  Calendar,
  Users,
  Flag,
  HelpCircle,
  Check,
  RotateCcw,
  LucideIcon,
  Sparkles,
} from 'lucide-react';
import {
  requirementService,
  RequirementType,
  RequirementPriority,
  RequirementCategory,
} from '../../services/requirement.service';
import { RichTextEditor } from '../../components/requirements/RichTextEditor';
import { can } from '../../services/requirementPermissions.service';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';
import { useToast } from '../../context/ToastContext';

interface AcceptanceCriterionDraft {
  code: string;
  description: string;
  verificationMethod: string;
}

const TYPE_CONFIG: Array<{
  type: RequirementType;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    type: 'FUNCTIONAL',
    label: 'Functional',
    description: 'Direct user-facing features, user stories, and application behavior',
    icon: Zap,
  },
  {
    type: 'NON_FUNCTIONAL',
    label: 'Non-Functional',
    description: 'System qualities, scalability, maintainability, and resilience',
    icon: Cpu,
  },
  {
    type: 'SECURITY',
    label: 'Security & Auth',
    description: 'Authentication, authorization, OWASP standards, and data protection',
    icon: Shield,
  },
  {
    type: 'PERFORMANCE',
    label: 'Performance',
    description: 'Response latency benchmarks, throughput limits, and resource ceilings',
    icon: Gauge,
  },
  {
    type: 'BUSINESS',
    label: 'Business Objective',
    description: 'Revenue, conversion goals, KPIs, and market initiatives',
    icon: Briefcase,
  },
  {
    type: 'TECHNICAL',
    label: 'Technical & Schema',
    description: 'Architecture migrations, database schema, refactoring, and tech debt',
    icon: Network,
  },
  {
    type: 'USABILITY',
    label: 'Usability & UI/UX',
    description: 'User flows, accessibility (WCAG), and responsive interface standards',
    icon: Smile,
  },
  {
    type: 'COMPLIANCE',
    label: 'Compliance & Legal',
    description: 'GDPR, SOC2, HIPAA, audit logs, and data retention policies',
    icon: CheckCircle,
  },
  {
    type: 'INTERFACE',
    label: 'API & Integrations',
    description: 'REST/GraphQL contracts, webhooks, and third-party integrations',
    icon: FileText,
  },
];

const STEPS = [
  { number: 1, title: 'Basic Details' },
  { number: 2, title: 'Category & Type' },
  { number: 3, title: 'Description' },
  { number: 4, title: 'Acceptance Criteria' },
  { number: 5, title: 'Assignment' },
  { number: 6, title: 'Priority & Dates' },
  { number: 7, title: 'Review & Submit' },
];

export const CreateRequirementWizard: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Storage key for resilient draft saving
  const draftStorageKey = useMemo(() => {
    return `devflow_req_draft_${routeProjectId || 'global'}_${user?.id || 'anon'}`;
  }, [routeProjectId, user]);

  // Form State
  const [projectId, setProjectId] = useState<number>(routeProjectId ? Number(routeProjectId) : 1);
  const [code, setCode] = useState<string>('REQ-001');
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [type, setType] = useState<RequirementType>('FUNCTIONAL');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);

  // Specifications
  const [description, setDescription] = useState<string>('');
  const [expectedBehavior, setExpectedBehavior] = useState<string>('');
  const [preconditions, setPreconditions] = useState<string>('');
  const [constraints, setConstraints] = useState<string>('');
  const [dependencies, setDependencies] = useState<string>('');
  const [businessJustification, setBusinessJustification] = useState<string>('');
  const [referenceLinks, setReferenceLinks] = useState<string>('');

  // Criteria
  const [criteria, setCriteria] = useState<AcceptanceCriterionDraft[]>([
    { code: 'AC-001', description: '', verificationMethod: '' },
  ]);

  // Assignment
  const [responsibleTeamId, setResponsibleTeamId] = useState<number | undefined>(undefined);
  const [responsibleMemberId, setResponsibleMemberId] = useState<number | undefined>(undefined);
  const [reviewerId, setReviewerId] = useState<number | undefined>(undefined);
  const [collaborators, setCollaborators] = useState<number[]>([]);

  // Assessment & Dates
  const [priority, setPriority] = useState<RequirementPriority>('MEDIUM');
  const [targetDate, setTargetDate] = useState<string>('');
  const [businessImpact, setBusinessImpact] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | ''>('');
  const [complexity, setComplexity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | ''>('');

  // Metadata from backend
  const [categories, setCategories] = useState<RequirementCategory[]>([]);
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: number; title: string }>>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | string>('');

  // Load Metadata & Next Code
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const metaRes = await requirementService.getMetadata(projectId);
        if (metaRes.success && metaRes.data) {
          setCategories(metaRes.data.categories || []);
          setMembers(metaRes.data.members || []);
          setTeams(metaRes.data.teams || []);
        }

        const tmplRes = await requirementService.getTemplates({ projectId });
        if (tmplRes.success && tmplRes.data) {
          setTemplates(tmplRes.data);
        }

        const codeRes = await requirementService.getNextCode(projectId);
        if (codeRes.success && codeRes.data) {
          setCode(codeRes.data.nextCode);
        }

        const projRes = await requirementService.getRequirements({});
        if (projRes.success && projRes.data) {
          setProjects(projRes.data.projects || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMeta();
  }, [projectId]);

  // Filter candidate reviewers to users with REVIEW permission, excluding author (Item 10)
  const canUserReview = (candidate: any) => {
    if (!candidate || (user && candidate.id === user.id)) return false;
    const role = candidate.orgRole || candidate.role;
    if (role === 'VIEWER') return false;

    const candidateContext = {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      orgRole: (candidate.orgRole as any) || 'MEMBER',
      projectRole:
        candidate.role === 'ADMIN' || candidate.orgRole === 'OWNER'
          ? ('OWNER' as const)
          : ('DEVELOPER' as const),
      isProjectOwner: candidate.orgRole === 'OWNER' || candidate.role === 'ADMIN',
    };
    const check = can(candidateContext as any, 'review', {
      id: 0,
      code: 'NEW',
      projectId: Number(projectId) || 1,
      authorId: user?.id || 0,
      reviewerId: candidate.id,
      workflowStatus: 'PENDING_REVIEW',
    });
    return check.allowed;
  };

  // Apply Template Helper
  const handleSelectTemplate = (templateId: number | string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tmpl = templates.find((t) => String(t.id) === String(templateId));
    if (!tmpl) return;

    try {
      const struct = typeof tmpl.structure === 'string' ? JSON.parse(tmpl.structure) : tmpl.structure;
      if (struct.title && !title) setTitle(struct.title);
      if (struct.type) setType(struct.type);
      if (struct.priority) setPriority(struct.priority);
      if (struct.description) setDescription(struct.description);
      if (struct.expectedBehavior) setExpectedBehavior(struct.expectedBehavior);
      if (struct.constraints) setConstraints(struct.constraints);
      if (struct.defaultAcceptanceCriteria && struct.defaultAcceptanceCriteria.length > 0) {
        setCriteria(
          struct.defaultAcceptanceCriteria.map((ac: any, idx: number) => ({
            code: ac.code || `AC-${String(idx + 1).padStart(3, '0')}`,
            description: ac.description || '',
            verificationMethod: ac.verificationMethod || '',
          }))
        );
      }
      toast.success('Template Applied', `Pre-populated structure from "${tmpl.name}".`);
    } catch (e) {
      console.error('Failed to parse template structure', e);
    }
  };


  // Restore draft from localStorage on initial mount
  useEffect(() => {
    const saved = localStorage.getItem(draftStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.type) setType(parsed.type);
        if (parsed.categoryId) setCategoryId(parsed.categoryId);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.expectedBehavior) setExpectedBehavior(parsed.expectedBehavior);
        if (parsed.preconditions) setPreconditions(parsed.preconditions);
        if (parsed.constraints) setConstraints(parsed.constraints);
        if (parsed.dependencies) setDependencies(parsed.dependencies);
        if (parsed.businessJustification) setBusinessJustification(parsed.businessJustification);
        if (parsed.referenceLinks) setReferenceLinks(parsed.referenceLinks);
        if (parsed.criteria && parsed.criteria.length > 0) setCriteria(parsed.criteria);
        if (parsed.responsibleTeamId) setResponsibleTeamId(parsed.responsibleTeamId);
        if (parsed.responsibleMemberId) setResponsibleMemberId(parsed.responsibleMemberId);
        if (parsed.reviewerId) setReviewerId(parsed.reviewerId);
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.targetDate) setTargetDate(parsed.targetDate);
        if (parsed.businessImpact) setBusinessImpact(parsed.businessImpact);
        if (parsed.riskLevel) setRiskLevel(parsed.riskLevel);
        if (parsed.complexity) setComplexity(parsed.complexity);
      } catch (err) {
        console.error('Failed to restore draft:', err);
      }
    }
  }, [draftStorageKey]);

  // Persist draft to localStorage on any state change
  const saveToLocalDraft = () => {
    const state = {
      projectId,
      code,
      title,
      summary,
      type,
      categoryId,
      description,
      expectedBehavior,
      preconditions,
      constraints,
      dependencies,
      businessJustification,
      referenceLinks,
      criteria,
      responsibleTeamId,
      responsibleMemberId,
      reviewerId,
      collaborators,
      priority,
      targetDate,
      businessImpact,
      riskLevel,
      complexity,
    };
    localStorage.setItem(draftStorageKey, JSON.stringify(state));
  };

  useEffect(() => {
    saveToLocalDraft();
  }, [
    projectId,
    title,
    summary,
    type,
    categoryId,
    description,
    expectedBehavior,
    preconditions,
    constraints,
    dependencies,
    businessJustification,
    referenceLinks,
    criteria,
    responsibleTeamId,
    responsibleMemberId,
    reviewerId,
    priority,
    targetDate,
    businessImpact,
    riskLevel,
    complexity,
  ]);

  // Step validation
  const validateStep = (stepNum: number): boolean => {
    if (stepNum === 1) {
      if (!title.trim() || title.trim().length < 2) {
        toast.error('Title is required', 'Please provide a descriptive requirement title (at least 2 characters).');
        return false;
      }
      return true;
    }
    if (stepNum === 4) {
      // Step 4 warning if criteria empty
      const validCriteria = criteria.filter((c) => c.description.trim().length > 0);
      if (validCriteria.length === 0) {
        toast.warning(
          'Zero Acceptance Criteria',
          'Requirements should have at least one acceptance criterion before submitting for review.'
        );
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 7));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Add acceptance criterion
  const addCriterion = () => {
    const nextIdx = criteria.length + 1;
    const nextCode = `AC-${String(nextIdx).padStart(3, '0')}`;
    setCriteria([...criteria, { code: nextCode, description: '', verificationMethod: '' }]);
  };

  // Remove acceptance criterion
  const removeCriterion = (index: number) => {
    if (criteria.length <= 1) return;
    const updated = criteria.filter((_, i) => i !== index);
    setCriteria(updated);
  };

  // Save as Draft (API)
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error('Title is required', 'Please specify a title before saving draft.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = {
        projectId,
        code,
        title,
        summary: summary || null,
        type,
        categoryId: categoryId || null,
        description: description || null,
        expectedBehavior: expectedBehavior || null,
        preconditions: preconditions || null,
        constraints: constraints || null,
        dependencies: dependencies || null,
        businessJustification: businessJustification || null,
        referenceLinks: referenceLinks || null,
        priority,
        responsibleTeamId: responsibleTeamId || null,
        responsibleMemberId: responsibleMemberId || null,
        reviewerId: reviewerId || null,
        collaborators,
        targetDate: targetDate || null,
        businessImpact: businessImpact || null,
        riskLevel: riskLevel || null,
        complexity: complexity || null,
        acceptanceCriteria: criteria.filter((c) => c.description.trim().length > 0),
        action: 'SAVE_DRAFT' as const,
        authorId: user?.id,
      };

      const res = await requirementService.createRequirement(payload);
      if (res.success && res.data) {
        localStorage.removeItem(draftStorageKey);
        toast.success('Draft Saved', `${res.data.code} has been saved as a draft.`);
        navigate(`/projects/${projectId}/requirements`);
      } else {
        toast.error('Draft Failed', res.error || 'Failed to save draft.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Submit for Review (API)
  const handleSubmitForReview = async () => {
    if (!title.trim()) {
      toast.error('Title is required', 'Please enter a requirement title.');
      setCurrentStep(1);
      return;
    }

    const validCriteria = criteria.filter((c) => c.description.trim().length > 0);
    if (validCriteria.length === 0) {
      toast.error(
        'Submission Blocked',
        'Requirements cannot be submitted for review with zero acceptance criteria. Please add at least one criterion.'
      );
      setCurrentStep(4);
      return;
    }

    // Rule 4: Author CANNOT approve own requirement & author cannot be designated reviewer
    if (reviewerId && user && reviewerId === user.id) {
      toast.error(
        'Governance Rule 4 Violation',
        'You cannot designate yourself as the reviewer of a requirement you author.'
      );
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        projectId,
        code,
        title,
        summary: summary || null,
        type,
        categoryId: categoryId || null,
        description: description || null,
        expectedBehavior: expectedBehavior || null,
        preconditions: preconditions || null,
        constraints: constraints || null,
        dependencies: dependencies || null,
        businessJustification: businessJustification || null,
        referenceLinks: referenceLinks || null,
        priority,
        responsibleTeamId: responsibleTeamId || null,
        responsibleMemberId: responsibleMemberId || null,
        reviewerId: reviewerId || null,
        collaborators,
        targetDate: targetDate || null,
        businessImpact: businessImpact || null,
        riskLevel: riskLevel || null,
        complexity: complexity || null,
        acceptanceCriteria: validCriteria,
        action: 'SUBMIT_FOR_REVIEW' as const,
        authorId: user?.id,
      };

      const res = await requirementService.createRequirement(payload);
      if (res.success && res.data) {
        localStorage.removeItem(draftStorageKey);
        toast.success(
          'Submitted for Review',
          `${res.data.code} has been submitted for formal review. Reviewers have been notified.`
        );
        navigate(`/projects/${projectId}/requirements/${res.data.id}`);
      } else {
        toast.error('Submission Failed', res.error || 'Failed to submit requirement.');
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'An unexpected network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (title.trim()) {
      saveToLocalDraft();
      toast.info('Draft Preserved', 'Your draft has been saved locally and can be resumed anytime.');
    }
    navigate(-1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08090B]/90 backdrop-blur-md flex flex-col overflow-hidden text-zinc-100">
      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <div className="h-14 border-b border-[#27272A] bg-[#0E0E10] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <FileText size={17} />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Create Requirement</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-blue-400 border border-zinc-700">
                {code}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400">7-Step Specification & Governance Wizard</div>
          </div>
        </div>

        {/* Global Action buttons in top bar */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <Save size={13} />
            <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close wizard"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Step Progress Indicator ─────────────────────────────────── */}
      <div className="border-b border-[#27272A] bg-[#121215] px-6 py-2.5 flex-shrink-0 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between min-w-[600px]">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.number}>
              <button
                onClick={() => setCurrentStep(s.number)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  currentStep === s.number
                    ? 'text-blue-400 font-bold'
                    : currentStep > s.number
                    ? 'text-zinc-300 hover:text-white'
                    : 'text-zinc-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors ${
                    currentStep === s.number
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : currentStep > s.number
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-600'
                  }`}
                >
                  {currentStep > s.number ? <Check size={12} /> : s.number}
                </div>
                <span>{s.title}</span>
              </button>
              {idx < STEPS.length - 1 && <div className="w-8 h-[1px] bg-zinc-800 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Wizard Step Body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* STEP 1: BASIC DETAILS */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">1. Basic Details</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Identify the project and core summary for this specification.
                </p>
              </div>

              {/* Template Quick Start Selector */}
              {templates.length > 0 && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/30 to-purple-950/20 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-300 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-400" />
                      Quick Start from Template
                    </span>
                    <span className="text-[10px] text-zinc-400">Pre-populates fields & criteria</span>
                  </div>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-blue-500/30 text-zinc-200 focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Start from Scratch (Blank Requirement)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.scope === 'SYSTEM' ? '(System Default)' : `(${t.scope})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Target Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Read-only Auto Generated ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Requirement ID (Auto-Generated)</span>
                  <span className="text-[11px] text-zinc-500 font-normal">Rule 6: Auto-incremented per project</span>
                </label>
                <input
                  type="text"
                  value={code}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono font-bold bg-zinc-900/60 border border-zinc-800 text-blue-400 cursor-not-allowed"
                />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Requirement Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., OAuth 2.0 Single Sign-On with Google & GitHub"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Executive Summary</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief one-paragraph summary of what this requirement delivers..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CATEGORY & TYPE */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">2. Category & Requirement Type</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select the appropriate architectural classification from the 9 standard requirement types.
                </p>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Category</label>
                <select
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 9 Requirement Types Card Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Requirement Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TYPE_CONFIG.map((t) => {
                    const IconComp = t.icon;
                    const isSelected = type === t.type;
                    return (
                      <div
                        key={t.type}
                        onClick={() => setType(t.type)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500 shadow-sm shadow-blue-500/20'
                            : 'bg-[#0E0E10] border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            <IconComp size={15} />
                          </div>
                          <div className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            {t.label}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{t.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DESCRIPTION & SPECIFICATIONS */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">3. Detailed Specifications</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Provide rich-text technical details, business justification, and architectural constraints.
                </p>
              </div>

              {/* Rich Text Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Detailed Description (Rich Text & Markdown)</label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe user stories, functional flows, tables, and architectural constraints..."
                  rows={8}
                />
              </div>

              {/* Expected Behavior */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Expected Behavior</label>
                <textarea
                  rows={2}
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  placeholder="The exact system output and state changes expected..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Preconditions & Constraints Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Preconditions</label>
                  <textarea
                    rows={2}
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    placeholder="Prerequisites, existing user states, config flags..."
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Constraints</label>
                  <textarea
                    rows={2}
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder="SLA limits, backward compatibility, database ceilings..."
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Business Justification */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Business Justification</label>
                <textarea
                  rows={2}
                  value={businessJustification}
                  onChange={(e) => setBusinessJustification(e.target.value)}
                  placeholder="Why is this requirement prioritized? What business value or risk does it address?"
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Technical Dependencies & Links */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Reference Links (one URL per line)</label>
                <input
                  type="text"
                  value={referenceLinks}
                  onChange={(e) => setReferenceLinks(e.target.value)}
                  placeholder="https://tools.ietf.org/html/rfc6749, https://owasp.org/..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* STEP 4: ACCEPTANCE CRITERIA */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">4. Acceptance Criteria</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Define measurable conditions required for requirement verification and approval.
                  </p>
                </div>

                <button
                  onClick={addCriterion}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Criterion</span>
                </button>
              </div>

              {/* Criteria List */}
              <div className="space-y-3">
                {criteria.map((crit, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-2.5 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {crit.code}
                      </span>
                      {criteria.length > 1 && (
                        <button
                          onClick={() => removeCriterion(index)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove criterion"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Description</label>
                      <input
                        type="text"
                        value={crit.description}
                        onChange={(e) => {
                          const updated = [...criteria];
                          updated[index].description = e.target.value;
                          setCriteria(updated);
                        }}
                        placeholder="e.g., Given valid OAuth tokens, system returns 200 and sets session cookie..."
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Verification Method (Optional)</label>
                      <input
                        type="text"
                        value={crit.verificationMethod}
                        onChange={(e) => {
                          const updated = [...criteria];
                          updated[index].verificationMethod = e.target.value;
                          setCriteria(updated);
                        }}
                        placeholder="e.g., Automated E2E Cypress test, Security penetration test"
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Zero Criteria Warning Box */}
              {criteria.filter((c) => c.description.trim().length > 0).length === 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                  <span>
                    Warning: You currently have 0 filled acceptance criteria. You can save a draft, but formal submission
                    will require at least one criterion.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: ASSIGNMENT & GOVERNANCE */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">5. Team Assignment & Governance</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Assign responsible teams and designated reviewers. Governance enforces that authors cannot review their own work.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Responsible Team */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Responsible Team</label>
                  <select
                    value={responsibleTeamId || ''}
                    onChange={(e) => setResponsibleTeamId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Responsible Member */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Responsible Member</label>
                  <select
                    value={responsibleMemberId || ''}
                    onChange={(e) => setResponsibleMemberId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Designated Reviewer */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Designated Reviewer</span>
                  <span className="text-[11px] text-zinc-500">Rule 4: Author cannot review own requirement</span>
                </label>
                <select
                  value={reviewerId || ''}
                  onChange={(e) => setReviewerId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Designated Reviewer...</option>
                  {members
                    .filter((m) => canUserReview(m))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              {/* Author Warning if same as reviewer */}
              {reviewerId && user && reviewerId === user.id && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-300">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                  <span>Governance Violation: The author cannot be designated as the reviewer.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: PRIORITY & DATES */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">6. Priority, Risk & Deadlines</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Set business priority and target dates for delivery tracking.
                </p>
              </div>

              {/* Priority Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Priority Level</label>
                <div className="grid grid-cols-4 gap-2.5">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RequirementPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                        priority === p
                          ? p === 'CRITICAL'
                            ? 'bg-red-600 text-white shadow-md shadow-red-900/40'
                            : p === 'HIGH'
                            ? 'bg-red-500/20 text-red-400 border border-red-500'
                            : p === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-600'
                          : 'bg-[#0E0E10] border border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Target Delivery Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Risk Level & Complexity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Risk Level</label>
                  <select
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Unassessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Complexity</label>
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Unassessed</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="VERY_HIGH">Very High</option>
                  </select>
                </div>
              </div>

              {/* Business Impact Assessment */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Business Impact Assessment</label>
                <textarea
                  rows={2}
                  value={businessImpact}
                  onChange={(e) => setBusinessImpact(e.target.value)}
                  placeholder="Anticipated customer impact or operational change..."
                  className="w-full px-3 py-2 rounded-lg text-xs bg-[#0E0E10] border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW & SUBMIT */}
          {currentStep === 7 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <h2 className="text-base font-bold text-white">7. Review & Submit</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Confirm all details before submitting for formal governance review or saving as draft.
                </p>
              </div>

              <div className="border border-[#27272A] rounded-xl bg-[#0E0E10] p-4 divide-y divide-[#27272A] space-y-4 text-xs">
                {/* Summary Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-400 mr-2">{code}</span>
                    <span className="font-bold text-white text-sm">{title || 'Untitled'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {priority}
                  </span>
                </div>

                {/* Classification */}
                <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-zinc-400">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Type</span>
                    <span className="text-zinc-200 font-medium">{type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Category</span>
                    <span className="text-zinc-200 font-medium">
                      {categories.find((c) => c.id === categoryId)?.name || 'Uncategorized'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Target Date</span>
                    <span className="text-zinc-200 font-medium">{targetDate || 'None set'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Reviewer</span>
                    <span className="text-zinc-200 font-medium">
                      {members.find((m) => m.id === reviewerId)?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Acceptance Criteria Summary */}
                <div className="pt-3 space-y-2">
                  <div className="font-semibold text-zinc-300">
                    Acceptance Criteria ({criteria.filter((c) => c.description.trim()).length})
                  </div>
                  <div className="space-y-1.5">
                    {criteria
                      .filter((c) => c.description.trim().length > 0)
                      .map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-zinc-300">
                          <span className="font-mono text-blue-400 text-[11px] font-semibold">{c.code}:</span>
                          <span>{c.description}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Submit / Draft Actions */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                <div className="font-semibold text-blue-300 text-xs">Ready for Review?</div>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  Submitting transitions this requirement to <strong>Pending Review</strong> and writes an immutable Activity Event.
                  The designated reviewer will review and evaluate the acceptance criteria.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Wizard Footer Navigation Bar ────────────────────────────── */}
      <div className="h-16 border-t border-[#27272A] bg-[#0E0E10] px-6 flex items-center justify-between flex-shrink-0">
        <button
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            <Save size={14} />
            <span>{isSavingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
          </button>

          {currentStep < 7 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-500/20 transition-all"
            >
              <span>Next</span>
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmitForReview}
              disabled={isSubmitting || isSavingDraft}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-500/20 transition-all"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Submitting...' : 'Submit for Review'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
