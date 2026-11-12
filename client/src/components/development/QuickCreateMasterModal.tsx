import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, GitCommitHorizontal, X, AlertCircle } from 'lucide-react';
import { developmentService } from '../../services/development.service';
import type {
  DevelopmentModuleMaster,
  DevelopmentSubmoduleMaster,
} from '../../types/development';
import { useAccentTheme } from '../../services/accentTheme.service';

const COLOR_SWATCHES = [
  '#6366F1',
  '#8B5CF6',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#F97316',
  '#EC4899',
];

const ICON_OPTIONS = [
  'Layers',
  'Code2',
  'Database',
  'ShieldCheck',
  'Cpu',
  'Globe',
  'Server',
  'GitBranch',
];

interface QuickCreateMasterModalProps {
  isOpen: boolean;
  mode: 'module' | 'submodule';
  projectId: number;
  parentModule?: DevelopmentModuleMaster | null;
  onClose: () => void;
  onCreatedModule?: (mod: DevelopmentModuleMaster) => void;
  onCreatedSubmodule?: (sub: DevelopmentSubmoduleMaster) => void;
}

export const QuickCreateMasterModal: React.FC<QuickCreateMasterModalProps> = ({
  isOpen,
  mode,
  projectId,
  parentModule,
  onClose,
  onCreatedModule,
  onCreatedSubmodule,
}) => {
  const { accentColor } = useAccentTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [icon, setIcon] = useState(mode === 'module' ? 'Layers' : 'GitCommitHorizontal');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`${mode === 'module' ? 'Module' : 'Submodule'} name is required`);
      return;
    }

    setIsSaving(true);
    setError(null);

    if (mode === 'module') {
      const res = await developmentService.createModule(projectId, {
        name: trimmed,
        description: description.trim() || undefined,
        color,
        icon,
      });
      setIsSaving(false);
      if (res.success && res.data) {
        onCreatedModule?.(res.data);
        setName('');
        setDescription('');
        onClose();
      } else {
        setError(res.error || 'Failed to create module');
      }
    } else {
      if (!parentModule) {
        setIsSaving(false);
        setError('Please select a parent module first');
        return;
      }
      const res = await developmentService.createSubmodule(projectId, {
        moduleId: parentModule.id,
        name: trimmed,
        description: description.trim() || undefined,
        icon,
      });
      setIsSaving(false);
      if (res.success && res.data) {
        onCreatedSubmodule?.(res.data);
        setName('');
        setDescription('');
        onClose();
      } else {
        setError(res.error || 'Failed to create submodule');
      }
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16 }}
          className="w-full max-w-md rounded-2xl bg-[#0E0F14] border border-[#27272A] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A] bg-[#12141B]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}1E`, color: accentColor }}
              >
                {mode === 'module' ? <Layers size={16} /> : <GitCommitHorizontal size={16} />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {mode === 'module' ? 'Add New Module Master' : 'Add New Submodule Master'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {mode === 'module'
                    ? 'Persisted to database for all development tasks'
                    : `Scoped under "${parentModule?.name || 'Module'}"`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1E202B] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                {mode === 'module' ? 'Module Name' : 'Submodule Name'}{' '}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  mode === 'module' ? 'e.g., Authentication, Billing API' : 'e.g., OAuth2 Flow, Invoices'
                }
                className="w-full px-3 py-2 rounded-xl bg-[#161820] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Description (optional)</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief scope or responsibility..."
                className="w-full px-3 py-2 rounded-xl bg-[#161820] border border-[#27272A] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>

            {mode === 'module' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Accent Color</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColor(swatch)}
                      className="w-6 h-6 rounded-full border-2 transition-transform cursor-pointer hover:scale-110"
                      style={{
                        backgroundColor: swatch,
                        borderColor: color === swatch ? '#FFFFFF' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Icon Tag</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer"
                    style={
                      icon === ic
                        ? {
                            backgroundColor: `${accentColor}1E`,
                            borderColor: accentColor,
                            color: '#FFFFFF',
                          }
                        : {
                            backgroundColor: '#161820',
                            borderColor: '#27272A',
                            color: '#A1A1AA',
                          }
                    }
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272A]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-300 bg-[#161820] hover:bg-[#1E202B] border border-[#27272A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all cursor-pointer hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {isSaving
                  ? 'Saving...'
                  : mode === 'module'
                  ? 'Create & Select Module'
                  : 'Create & Select Submodule'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

