import React, { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { DocumentCategory } from '../../types/document';
import { documentService } from '../../services/document.service';

interface CategoryManageModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  categories: DocumentCategory[];
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
  categories: _categories,
  onCategoryCreated,
}) => {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Folder');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a folder name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await documentService.createCategory(projectId, {
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
      });

      if (res.success && res.data) {
        onCategoryCreated(res.data);
        setName('');
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
      <div className="bg-[#17181D] border border-[#27272A] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#27272A] flex items-center justify-between">
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
                      isSelected
                        ? 'border-blue-500 bg-blue-500/15 text-blue-400 shadow-sm'
                        : 'border-[#27272A] bg-[#0E0F14] text-zinc-400 hover:text-white hover:border-zinc-700'
                    )}
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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
