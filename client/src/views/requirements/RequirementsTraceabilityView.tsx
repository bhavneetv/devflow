import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Layers,
  Table,
  GitMerge,
  Filter,
  Download,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
  CheckSquare,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { requirementService } from '../../services/requirement.service';
import {
  WorkflowStatusBadge,
  PriorityBadge,
  ImplementationStatusBadge,
  RequirementTypeBadge,
} from '../../components/requirements/RequirementBadges';

export const RequirementsTraceabilityView: React.FC = () => {
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'matrix' | 'tree'>('matrix');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [warningFilter, setWarningFilter] = useState('ALL');
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  const loadTraceability = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await requirementService.getTraceability({
        projectId: routeProjectId ? Number(routeProjectId) : undefined,
      });
      if (res.success && res.data) {
        setData(res.data);
        // Default expand first 5 tree items
        const initialExpanded: Record<number, boolean> = {};
        res.data.tree.slice(0, 5).forEach((t: any) => {
          initialExpanded[t.id] = true;
        });
        setExpandedNodes(initialExpanded);
      }
    } catch (err) {
      console.error('Failed to load traceability', err);
    } finally {
      setIsLoading(false);
    }
  }, [routeProjectId]);

  useEffect(() => {
    loadTraceability();
  }, [loadTraceability]);

  const toggleNode = (id: number) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter matrix items
  const filteredMatrix = useMemo(() => {
    if (!data?.matrix) return [];
    return data.matrix.filter((item: any) => {
      const matchesSearch =
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (warningFilter === 'WARNINGS_ONLY') {
        return item.warnings.length > 0;
      }
      if (warningFilter === 'NO_CRITERIA') {
        return item.warnings.some((w: any) => w.code === 'NO_CRITERIA');
      }
      if (warningFilter === 'APPROVED_NO_TASKS') {
        return item.warnings.some((w: any) => w.code === 'APPROVED_NO_TASKS');
      }
      if (warningFilter === 'OVERDUE') {
        return item.warnings.some((w: any) => w.code === 'OVERDUE_UNVERIFIED');
      }
      return true;
    });
  }, [data?.matrix, searchQuery, warningFilter]);

  const coverage = data?.coverage || {
    total: 0,
    withCriteriaCount: 0,
    withCriteriaPercent: 0,
    withTasksCount: 0,
    withTasksPercent: 0,
    withTestsCount: 0,
    withTestsPercent: 0,
    fullyVerifiedCount: 0,
    fullyVerifiedPercent: 0,
    withWarningsCount: 0,
  };

  const handleExportCsv = () => {
    requirementService.exportTraceabilityCsv({
      projectId: routeProjectId ? Number(routeProjectId) : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="border-b border-[#27272A] bg-[#0E0E10] px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Link
                to={routeProjectId ? `/projects/${routeProjectId}/requirements` : '/requirements'}
                className="hover:text-zinc-200 transition-colors flex items-center gap-1 text-blue-400"
              >
                <ArrowLeft size={14} /> Back to Requirements
              </Link>
              <ChevronRight size={13} className="text-zinc-600" />
              <span>Traceability Matrix & End-to-End Coverage</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                TRACEABILITY
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Requirements Traceability & Coverage Reports
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs">
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'matrix'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Table size={13} /> Matrix Table
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === 'tree'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <GitMerge size={13} /> Hierarchy Tree
              </button>
            </div>

            <button
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* 2. COVERAGE METRIC CARDS */}
      <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Acceptance Criteria Coverage */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Criteria Coverage
              </span>
              <CheckSquare size={16} className="text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {coverage.withCriteriaPercent}%
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ({coverage.withCriteriaCount}/{coverage.total})
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${coverage.withCriteriaPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Specifications with ≥ 1 acceptance criterion
            </span>
          </div>

          {/* Card 2: Task Coverage */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Task Coverage
              </span>
              <Layers size={16} className="text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {coverage.withTasksPercent}%
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ({coverage.withTasksCount}/{coverage.total})
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${coverage.withTasksPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Specifications broken down into execution tasks
            </span>
          </div>

          {/* Card 3: Test Coverage */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                QA Test Coverage
              </span>
              <Shield size={16} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {coverage.withTestsPercent}%
              </span>
              <span className="text-xs text-zinc-400 font-mono">(QA Module Pending)</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${coverage.withTestsPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 block">
              Verified by automated/manual QA suites
            </span>
          </div>

          {/* Card 4: Full Verification */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Verified Complete
              </span>
              <CheckCircle2 size={16} className="text-teal-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {coverage.fullyVerifiedPercent}%
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ({coverage.fullyVerifiedCount}/{coverage.total})
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${coverage.fullyVerifiedPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 block">
              All criteria verified & status VERIFIED
            </span>
          </div>
        </div>

        {/* 3. FILTER & SEARCH BAR */}
        <div className="p-3.5 rounded-xl bg-[#0E0E10] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by ID or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-zinc-500" />
              <select
                value={warningFilter}
                onChange={(e) => setWarningFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none text-xs"
              >
                <option value="ALL">All Requirements</option>
                <option value="WARNINGS_ONLY">Items With Warnings ({coverage.withWarningsCount})</option>
                <option value="NO_CRITERIA">No Acceptance Criteria</option>
                <option value="APPROVED_NO_TASKS">Approved Without Tasks</option>
                <option value="OVERDUE">Overdue & Unverified</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-zinc-500 font-mono">
            Showing {filteredMatrix.length} of {coverage.total} specifications
          </div>
        </div>

        {/* 4. CONTENT VIEW: MATRIX TABLE OR TREE HIERARCHY */}
        {viewMode === 'matrix' ? (
          /* MATRIX TABLE */
          <div className="rounded-xl border border-[#27272A] overflow-hidden bg-[#0E0E10]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#121214] text-zinc-400 border-b border-[#27272A]">
                <tr>
                  <th className="py-3 px-3.5">ID</th>
                  <th className="py-3 px-3.5">Specification Title</th>
                  <th className="py-3 px-3.5">Workflow</th>
                  <th className="py-3 px-3.5">Implementation</th>
                  <th className="py-3 px-3.5 text-center">Criteria (AC)</th>
                  <th className="py-3 px-3.5 text-center">Tasks</th>
                  <th className="py-3 px-3.5 text-center">Tests</th>
                  <th className="py-3 px-3.5">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {filteredMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500 text-xs">
                      No requirements match the selected traceability filters.
                    </td>
                  </tr>
                ) : (
                  filteredMatrix.map((item: any) => (
                    <tr
                      key={item.id}
                      onClick={() =>
                        navigate(`/projects/${item.projectId}/requirements/${item.id}`)
                      }
                      className="hover:bg-[#161619] cursor-pointer transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-400">
                        {item.code}
                      </td>

                      {/* Title & Type */}
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-zinc-200 truncate max-w-xs">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <RequirementTypeBadge type={item.type} />
                          <PriorityBadge priority={item.priority} />
                        </div>
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3 px-3.5">
                        <WorkflowStatusBadge status={item.workflowStatus} />
                      </td>

                      {/* Implementation Status */}
                      <td className="py-3 px-3.5">
                        <ImplementationStatusBadge status={item.implementationStatus} />
                      </td>

                      {/* Criteria */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded font-semibold ${
                            item.criteriaCount === 0
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : item.completedCriteriaCount === item.criteriaCount
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {item.completedCriteriaCount}/{item.criteriaCount}
                        </span>
                      </td>

                      {/* Tasks */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded ${
                            item.tasksCount === 0
                              ? 'bg-zinc-800 text-zinc-500'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {item.tasksCount} Tasks
                        </span>
                      </td>

                      {/* Tests */}
                      <td className="py-3 px-3.5 text-center text-zinc-600 font-mono text-[11px]">
                        QA Off
                      </td>

                      {/* Warnings */}
                      <td className="py-3 px-3.5">
                        {item.warnings.length === 0 ? (
                          <span className="text-zinc-600 font-mono text-[11px]">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {item.warnings.map((w: any) => (
                              <span
                                key={w.code}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                  w.severity === 'red'
                                    ? 'bg-red-950/50 text-red-400 border border-red-500/30'
                                    : 'bg-amber-950/50 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                <AlertTriangle size={10} />
                                {w.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* HIERARCHICAL TREE VIEW */
          <div className="space-y-4">
            {data?.tree?.map((node: any) => {
              const isExpanded = expandedNodes[node.id];
              const hasCriteria = node.criteria && node.criteria.length > 0;
              const hasTasks = node.tasks && node.tasks.length > 0;

              return (
                <div
                  key={node.id}
                  className="rounded-xl border border-[#27272A] bg-[#0E0E10] overflow-hidden"
                >
                  {/* Root Node Header */}
                  <div
                    onClick={() => toggleNode(node.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-zinc-500 hover:text-white">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {node.code}
                      </span>

                      <span className="font-semibold text-sm text-zinc-100">{node.title}</span>

                      <RequirementTypeBadge type={node.type} />
                      <WorkflowStatusBadge status={node.workflowStatus} />
                    </div>

                    <div className="flex items-center gap-2">
                      {!hasCriteria && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold flex items-center gap-1">
                          <AlertCircle size={11} /> 0 Criteria
                        </span>
                      )}
                      {node.workflowStatus === 'APPROVED' && !hasTasks && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold flex items-center gap-1">
                          <AlertTriangle size={11} /> 0 Tasks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Tree Children */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 bg-zinc-950/40 p-4 pl-10 space-y-4 text-xs">
                      {/* Level 2: Acceptance Criteria */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                          Acceptance Criteria ({node.criteria?.length || 0})
                        </span>
                        {!hasCriteria ? (
                          <div className="text-red-400/80 italic pl-3">
                            No acceptance criteria defined for this specification.
                          </div>
                        ) : (
                          node.criteria.map((c: any) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2.5 pl-3 py-1 border-l-2 border-blue-500/30"
                            >
                              <span className="font-mono text-[11px] text-blue-400">{c.code}</span>
                              <span
                                className={`text-zinc-300 ${
                                  c.isComplete ? 'line-through text-zinc-500' : ''
                                }`}
                              >
                                {c.description}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  c.isComplete
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-zinc-800 text-zinc-500'
                                }`}
                              >
                                {c.isComplete ? 'VERIFIED' : 'PENDING'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Level 3: Tasks */}
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                          Execution Tasks ({node.tasks?.length || 0})
                        </span>
                        {!hasTasks ? (
                          <div className="text-zinc-500 italic pl-3">
                            No tasks linked yet. Tasks module placeholder active.
                          </div>
                        ) : (
                          node.tasks.map((t: any) => (
                            <div
                              key={t.id}
                              className="flex items-center gap-2.5 pl-3 py-1 border-l-2 border-purple-500/30"
                            >
                              <span className="font-mono text-[11px] text-purple-400">
                                TASK-{t.id}
                              </span>
                              <span className="text-zinc-200">{t.title}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {t.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

