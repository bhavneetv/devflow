import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  Briefcase,
  FileText,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  PenTool,
  Archive,
  Code,
  Shield,
  Layers,
  Globe,
  Loader2,
  Check,
  FolderPlus,
  FolderTree,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentCategory } from '../../types/document';
import { documentService } from '../../services/document.service';
import { AnimatedSelect } from '../settings/AnimatedSelect';
import { useAccentTheme } from '../../services/accentTheme.service';

interface CategoryManageModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
  initialParentId?: number | null;
  onCategoryCreated: (newCat: DocumentCategory) => void;
}

const FOLDER_ICONS = [
  { id: 'Folder', icon: Folder, label: 'Folder' },
  { id: 'Briefcase', icon: Briefcase, label: 'Work' },
  { id: 'FileText', icon: FileText, label: 'Specs' },
  { id: 'Image', icon: ImageIcon, label: 'Designs' },
  { id: 'BarChart3', icon: BarChart3, label: 'Reports' },
  { id: 'Calendar', icon: Calendar, label: 'Notes' },
  { id: 'PenTool', icon: PenTool, label: 'Whiteboards' },
  { id: 'Archive', icon: Archive, label: 'Archive' },
  { id: 'Code', icon: Code, label: 'Code' },
  { id: 'Shield', icon: Shield, label: 'Security' },
  { id: 'Layers', icon: Layers, label: 'Assets' },
  { id: 'Globe', icon: Globe, label: 'Public' },
];

const PRESET_COLORS = [
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#8B5CF6', label: 'Purple' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#EF4444', label: 'Rose' },
  { hex: '#06B6D4', label: 'Cyan' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#6B7280', label: 'Zinc' },
];

export const CategoryManageModal: React.FC<CategoryManageModalProps> = ({
  projectId,
  isOpen,
  onClose,
  categories,
  initialParentId = null,
  onCategoryCreated,
}) => {
  const [name, setName] = useState('');
  const { accentColor } = useAccentTheme();
  const [parentFolderId, setParentFolderId] = useState<number | null>(initialParentId);
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setParentFolderId(initialParentId ?? null);
      setError(null);
    }
  }, [isOpen, initialParentId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = name.trim();
    if (!cleanedName) {
      setError('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const parentCat = parentFolderId
        ? categories.find((c) => c.id === parentFolderId)
        : undefined;
      const finalName = parentCat ? `${parentCat.name} / ${cleanedName}` : cleanedName;

      const res = await documentService.createCategory(projectId, {
        name: finalName,
        icon: selectedIcon,
        color: selectedColor,
      });

      if (res.success && res.data) {
        onCategoryCreated(res.data);
        setName('');
        setParentFolderId(null);
        setSelectedIcon('Folder');
        setSelectedColor(PRESET_COLORS[0].hex);
        onClose();
      } else {
        setError(res.error || 'Failed to create folder');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ActiveIconComponent = FOLDER_ICONS.find((i) => i.id === selectedIcon)?.icon || Folder;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#17181D] border border-[#27272A] rounded-2xl w-full max-w-md shadow-2xl overflow-visible flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#27272A] flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${selectedColor}15`,
                borderColor: `${selectedColor}30`,
                color: selectedColor,
              }}
            >
              <ActiveIconComponent size={16} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-white tracking-tight">
                Create New Folder
              </h3>
              <p className="text-[11px] text-zinc-500">
                Organize documents into structured folders
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* 1. Folder Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Folder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Architecture Specs, Client Invoices, Designs"
              autoFocus
              className="w-full bg-[#0E0F14] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 1b. Parent Folder (Subfolder Support) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <FolderTree size={12} style={{ color: accentColor }} />
              <span>Location / Parent Folder</span>
            </label>
            <AnimatedSelect
              value={parentFolderId !== null ? String(parentFolderId) : ''}
              onChange={(val) => setParentFolderId(val ? Number(val) : null)}
              options={[
                {
                  value: '',
                  label: 'Root (Top-Level Folder)',
                  icon: <Folder size={13} className="text-zinc-400" />,
                  sublabel: 'Root directory',
                },
                ...categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                  icon: (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.color || '#3B82F6' }}
                    />
                  ),
                  sublabel: `${c._count?.documents || 0} files`,
                })),
              ]}
              accentColor={selectedColor}
              placeholder="Choose parent folder..."
              searchPlaceholder="Search parent folder..."
            />
          </div>

          {/* 2. Avatar / Icon Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Avatar / Icon
            </label>
            <div className="grid grid-cols-6 gap-2">
              {FOLDER_ICONS.map((item) => {
                const IconComp = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedIcon(item.id)}
                    title={item.label}
                    className={cn(
                      'h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border',
                      !isSelected && 'border-[#27272A] bg-[#0E0F14] text-zinc-400 hover:text-white hover:border-zinc-700'
                    )}
                    style={
                      isSelected
                        ? {
                            borderColor: accentColor,
                            backgroundColor: `${accentColor}20`,
                            color: accentColor,
                          }
                        : undefined
                    }
                  >
                    <IconComp size={16} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Colour Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Colour
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    title={c.label}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer relative',
                      isSelected && 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#17181D] scale-110'
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check size={12} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#27272A] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B10] transition-all shadow-sm disabled:opacity-50 cursor-pointer hover:brightness-110"
              style={{ backgroundColor: accentColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FolderPlus size={14} />
                  <span>Create Folder</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
