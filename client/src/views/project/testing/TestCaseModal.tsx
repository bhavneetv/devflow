import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Plus, Tag, Trash2, X } from 'lucide-react';
import { testingService } from '../../../services/testing.service';
import { useAccentTheme } from '../../../services/accentTheme.service';
import { useToast } from '../../../context/ToastContext';
import { AnimatedSelect, type SelectOption } from '../../../components/settings/AnimatedSelect';
import { MasterOptionSelect, type TestingMasterCategory } from '../../../components/testing/testingBadges';
import { TestingAttachmentsPanel } from '../../../components/testing/TestingAttachmentsPanel';
import type {
  TestCaseDetail,
  TestCaseItem,
  TestingAttachmentDocument,
  TestingConfigurationItem,
  TestingMasterOption,
  TestingMetaData,
  TestingPermissions,
} from '../../../types/testing';

interface StepDraft {
  action: string;
  testData: string;
  expectedResult: string;
}

interface TestCaseModalProps {
  projectId: number;
  isOpen: boolean;
  editingCase?: TestCaseDetail | TestCaseItem | null;
  meta: TestingMetaData;
  config: TestingConfigurationItem;
  permissions: TestingPermissions;
  onConfigUpdated: (cfg: TestingConfigurationItem) => void;
  onClose: () => void;
  onSaved: (saved: TestCaseDetail) => void;
}

export const TestCaseModal: React.FC<TestCaseModalProps> = ({
  projectId,
  isOpen,
  editingCase,
  meta,
  config,
  permissions,
  onConfigUpdated,
  onClose,
  onSaved,
}) => {
  const { accentColor } = useAccentTheme();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [submoduleId, setSubmoduleId] = useState('');
  const [testType, setTestType] = useState('Functional');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Draft');
  const [assignedTesterId, setAssignedTesterId] = useState('');
  const [linkedRequirementId, setLinkedRequirementId] = useState('');
  const [linkedDevTaskId, setLinkedDevTaskId] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([{ action: '', testData: '', expectedResult: '' }]);
  const [attachments, setAttachments] = useState<TestingAttachmentDocument[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingCase) {
      setTitle(editingCase.title || '');
      setDescription(editingCase.description || '');
      setPreconditions(editingCase.preconditions || '');
      setModuleId(editingCase.moduleId ? String(editingCase.moduleId) : '');
      setSubmoduleId(editingCase.submoduleId ? String(editingCase.submoduleId) : '');
      setTestType(editingCase.testType || config.testTypes?.[0]?.name || 'Functional');
      setPriority(editingCase.priority || 'Medium');
      setStatus(editingCase.status || 'Draft');
      setAssignedTesterId(editingCase.assignedTesterId ? String(editingCase.assignedTesterId) : '');
      setLinkedRequirementId(editingCase.linkedRequirementId ? String(editingCase.linkedRequirementId) : '');
      setLinkedDevTaskId(editingCase.linkedDevTaskId ? String(editingCase.linkedDevTaskId) : '');
      setLabels(editingCase.labels || []);
      const existingSteps = (editingCase as TestCaseDetail).steps;
      if (existingSteps && existingSteps.length > 0) {
        setSteps(
          existingSteps
            .slice()
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((s) => ({
              action: s.action,
              testData: s.testData || '',
              expectedResult: s.expectedResult || '',
            }))
        );
      } else {
        setSteps([{ action: '', testData: '', expectedResult: '' }]);
      }
      setAttachments((editingCase as TestCaseDetail).attachments || []);
    } else {
      setTitle('');
      setDescription('');
      setPreconditions('');
      setModuleId('');
      setSubmoduleId('');
      setTestType(config.testTypes?.[0]?.name || 'Functional');
      setPriority(config.priorities?.[2]?.name || 'Medium');
      setStatus('Ready');
      setAssignedTesterId('');
      setLinkedRequirementId('');
      setLinkedDevTaskId('');
      setLabels([]);
      setSteps([{ action: '', testData: '', expectedResult: '' }]);
      setAttachments([]);
    }
    setLabelInput('');
  }, [isOpen, editingCase, config]);

  if (!isOpen) return null;

  const selectedModule = meta.modules.find((m) => String(m.id) === moduleId);
  const moduleOptions: SelectOption[] = [
    { value: '', label: 'None / General' },
    ...meta.modules.map((m) => ({ value: String(m.id), label: m.name })),
  ];
  const submoduleOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...(selectedModule?.submodules || []).map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const testerOptions: SelectOption[] = [
    { value: '', label: 'Unassigned' },
    ...meta.members.map((m) => ({
      value: String(m.id),
      label: m.name || m.email || `User #${m.id}`,
      sublabel: m.email || undefined,
    })),
  ];
  const requirementOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...meta.requirements.map((r) => ({
      value: String(r.id),
      label: r.code ? `${r.code} — ${r.title}` : r.title,
      sublabel: r.workflowStatus,
    })),
  ];
  const devTaskOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...meta.devTasks.map((t) => ({
      value: String(t.id),
      label: `${t.taskKey} — ${t.title}`,
      sublabel: t.status,
    })),
  ];

  const handleOptionCreated = (category: TestingMasterCategory, updated: TestingMasterOption[]) => {
    onConfigUpdated({ ...config, [category]: updated });
  };

  const addLabelChip = () => {
    const clean = labelInput.trim();
    if (!clean) return;
    if (!labels.includes(clean)) setLabels([...labels, clean]);
    setLabelInput('');
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const nextIdx = index + dir;
    if (nextIdx < 0 || nextIdx >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, item);
    setSteps(copy);
  };

  const refreshAttachments = async () => {
    if (!editingCase) return;
    const res = await testingService.getTestCaseDetail(projectId, editingCase.id);
    if (res.success && res.data) {
      setAttachments(res.data.attachments || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Test case title is required');
      return;
    }

    const nonEmptySteps = steps.filter(
      (s) => s.action.trim() || s.testData.trim() || s.expectedResult.trim()
    );
    const invalidStep = nonEmptySteps.find((s) => !s.action.trim());
    if (invalidStep) {
      toast.error('Each test step must have an action/instruction');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        preconditions: preconditions.trim() || null,
        moduleId: moduleId ? Number(moduleId) : null,
        submoduleId: submoduleId ? Number(submoduleId) : null,
        testType,
        priority,
        status,
        assignedTesterId: assignedTesterId ? Number(assignedTesterId) : null,
        linkedRequirementId: linkedRequirementId ? Number(linkedRequirementId) : null,
        linkedDevTaskId: linkedDevTaskId ? Number(linkedDevTaskId) : null,
        labels,
        steps: nonEmptySteps.map((s, idx) => ({
          stepNumber: idx + 1,
          action: s.action.trim(),
          testData: s.testData.trim() || null,
          expectedResult: s.expectedResult.trim() || null,
        })),
      };

      const res = editingCase
        ? await testingService.updateTestCase(projectId, editingCase.id, payload)
        : await testingService.createTestCase(projectId, payload);

      if (res.success && res.data) {
        toast.success(editingCase ? `Updated ${res.data.caseKey}` : `Created ${res.data.caseKey}`);
        onSaved(res.data);
      } else {
        toast.error(res.error || 'Failed to save test case');
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0F1216] border-l border-white/10 h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#13161B]">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editingCase ? `Edit ${editingCase.caseKey}` : 'Create Test Case'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {editingCase
                ? 'Editing test definition or steps preserves all previous test execution history.'
                : 'Define reusable manual test instructions, preconditions, and expected outcomes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Verify OAuth login token refresh on expiry"
              className="w-full bg-[#13161B] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MasterOptionSelect
              projectId={projectId}
              category="testTypes"
              label="Test Type"
              options={config.testTypes || []}
              value={testType}
              onChange={setTestType}
              canCreate={permissions.canManageSettings}
              onOptionCreated={(opts) => handleOptionCreated('testTypes', opts)}
            />
            <MasterOptionSelect
              projectId={projectId}
              category="priorities"
              label="Priority"
              options={config.priorities || []}
              value={priority}
              onChange={setPriority}
              canCreate={permissions.canManageSettings}
              onOptionCreated={(opts) => handleOptionCreated('priorities', opts)}
            />
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Case Status</label>
              <AnimatedSelect
                options={[
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Ready', label: 'Ready' },
                  { value: 'Deprecated', label: 'Deprecated' },
                ]}
                value={status}
                onChange={setStatus}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Application Module</label>
              <AnimatedSelect
                options={moduleOptions}
                value={moduleId}
                onChange={(val) => {
                  setModuleId(val);
                  setSubmoduleId('');
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Submodule</label>
              <AnimatedSelect
                options={submoduleOptions}
                value={submoduleId}
                onChange={setSubmoduleId}
                disabled={!moduleId}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Assigned Tester</label>
              <AnimatedSelect
                options={testerOptions}
                value={assignedTesterId}
                onChange={setAssignedTesterId}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Requirement</label>
              <AnimatedSelect
                options={requirementOptions}
                value={linkedRequirementId}
                onChange={setLinkedRequirementId}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Linked Development Task</label>
              <AnimatedSelect
                options={devTaskOptions}
                value={linkedDevTaskId}
                onChange={setLinkedDevTaskId}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope, business behavior, or context..."
                className="w-full resize-none bg-[#13161B] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Preconditions</label>
              <textarea
                rows={3}
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="Required user state, feature flags, seed data..."
                className="w-full resize-none bg-[#13161B] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">Labels</label>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {labels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white/[0.07] text-gray-200 border border-white/10"
                >
                  <Tag className="w-3 h-3 text-emerald-400" />
                  {lbl}
                  <button
                    type="button"
                    onClick={() => setLabels(labels.filter((l) => l !== lbl))}
                    className="ml-1 text-gray-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabelChip();
                  }
                }}
                placeholder="Add label and press Enter..."
                className="flex-1 bg-[#13161B] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={addLabelChip}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.06] text-gray-300 border border-white/10 hover:bg-white/10"
              >
                Add
              </button>
            </div>
          </div>

          {/* Ordered Test Steps */}
          <div className="rounded-xl bg-[#13161B] border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Test Steps</h3>
                <p className="text-[11px] text-gray-400">
                  Steps maintain strict sequence numbers during test execution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSteps([...steps, { action: '', testData: '', expectedResult: '' }])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-[#0B0D10]/80 border border-white/[0.08] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">Step #{idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveStep(idx, -1)}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === steps.length - 1}
                        onClick={() => moveStep(idx, 1)}
                        className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={steps.length <= 1}
                        onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-gray-500 hover:text-red-400 disabled:opacity-30"
                        title="Remove step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Action / Instruction</label>
                      <textarea
                        rows={2}
                        value={step.action}
                        onChange={(e) => {
                          const copy = [...steps];
                          copy[idx] = { ...copy[idx], action: e.target.value };
                          setSteps(copy);
                        }}
                        placeholder="Click Login button..."
                        className="w-full resize-none bg-[#13161B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Test Input / Data</label>
                      <textarea
                        rows={2}
                        value={step.testData}
                        onChange={(e) => {
                          const copy = [...steps];
                          copy[idx] = { ...copy[idx], testData: e.target.value };
                          setSteps(copy);
                        }}
                        placeholder="email=qa@devflow.io"
                        className="w-full resize-none bg-[#13161B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Expected Result</label>
                      <textarea
                        rows={2}
                        value={step.expectedResult}
                        onChange={(e) => {
                          const copy = [...steps];
                          copy[idx] = { ...copy[idx], expectedResult: e.target.value };
                          setSteps(copy);
                        }}
                        placeholder="Redirects to dashboard..."
                        className="w-full resize-none bg-[#13161B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editingCase && (
            <TestingAttachmentsPanel
              projectId={projectId}
              entityType="test_case"
              entityId={editingCase.id}
              attachments={attachments}
              availableDocuments={meta.projectDocuments}
              canEdit={permissions.canEditTestCases}
              onUpdated={() => void refreshAttachments()}
            />
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.06] text-gray-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? 'Saving...' : editingCase ? 'Save Changes' : 'Create Test Case'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
