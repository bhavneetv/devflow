import React, { useState } from 'react';
import { X, CheckSquare, Sparkles, FolderKanban, Flag } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

interface CreateModalProps {
  onIssueCreated?: (issue: any) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({ onIssueCreated }) => {
  const { isCreateOpen, setIsCreateOpen, activeProject } = useNavigation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('TODO');
  const [submitting, setSubmitting] = useState(false);

  if (!isCreateOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      // Create task via API
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          status,
          projectId: activeProject?.id || 1,
        }),
      });
      const data = await res.json();
      if (data.success && onIssueCreated) {
        onIssueCreated(data.data);
      }
      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error(err);
      setIsCreateOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800">
              DEV
            </span>
            <span className="font-semibold text-white text-sm">New Issue</span>
          </div>

          <button
            onClick={() => setIsCreateOpen(false)}
            className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <input
              type="text"
              autoFocus
              className="w-full bg-transparent border-0 outline-none text-white text-base font-semibold placeholder-zinc-600 tracking-tight"
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <textarea
              rows={3}
              className="w-full bg-transparent border-0 outline-none text-zinc-300 text-xs placeholder-zinc-600 resize-none"
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#27272A] flex-wrap">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-[#1C1C1F] border border-[#27272A] text-zinc-300 text-xs rounded-md px-2 py-1 outline-none"
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-[#1C1C1F] border border-[#27272A] text-zinc-300 text-xs rounded-md px-2 py-1 outline-none"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent</option>
            </select>

            <div className="text-[11px] text-zinc-500 ml-auto flex items-center gap-1">
              <FolderKanban size={12} />
              <span>{activeProject?.title || 'DevFlow Cloud Platform'}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272A]">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 text-xs font-semibold rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
