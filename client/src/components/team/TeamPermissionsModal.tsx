import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  Crown,
  Users,
  UserX,
  UserCheck,
  Settings,
  Mail,
  Edit3,
  X,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { teamService } from '../../services/team.service';
import { useToast } from '../../context/ToastContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import type { Team, TeamMemberPermissionItem, TeamMemberPermissions } from '../../types/team';

interface TeamPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
}

const PERMISSION_CONFIG: Array<{
  key: keyof TeamMemberPermissions;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'manageTeamMembers',
    label: 'Manage Team Members',
    description: 'Add or invite new members to the team',
    icon: <Users size={16} className="text-emerald-400" />,
  },
  {
    key: 'removeTeamMembers',
    label: 'Remove Team Members',
    description: 'Remove existing members from the team',
    icon: <UserX size={16} className="text-rose-400" />,
  },
  {
    key: 'manageMemberRoles',
    label: 'Manage Member Roles',
    description: 'Promote, demote, or change roles of team members',
    icon: <UserCheck size={16} className="text-amber-400" />,
  },
  {
    key: 'manageTeamDetails',
    label: 'Manage Team Details',
    description: 'Edit team name, description, color, and branding',
    icon: <Edit3 size={16} className="text-indigo-400" />,
  },
  {
    key: 'manageTeamSettings',
    label: 'Manage Team Settings',
    description: 'Modify team configurations and integrations',
    icon: <Settings size={16} className="text-cyan-400" />,
  },
  {
    key: 'manageInvitations',
    label: 'Manage Invitations',
    description: 'Resend and cancel pending invitations',
    icon: <Mail size={16} className="text-purple-400" />,
  },
];

export const TeamPermissionsModal: React.FC<TeamPermissionsModalProps> = ({
  isOpen,
  onClose,
  team,
}) => {
  const { toast } = useToast();
  const { accentColor } = useAccentTheme();
  const [members, setMembers] = useState<TeamMemberPermissionItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMemberPermissionItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    teamService
      .getPermissions(team.id)
      .then((res) => {
        if (res.success && res.data) {
          setMembers(res.data);
          if (res.data.length > 0) {
            // Default select first non-owner if available, or first member
            const nonOwner = res.data.find((m) => !m.isOwner);
            setSelectedMember(nonOwner || res.data[0]);
          }
        } else {
          toast.error('Failed to load permissions', res.error);
        }
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, team.id]);

  const handleToggle = async (permKey: keyof TeamMemberPermissions) => {
    if (!selectedMember || selectedMember.isOwner) return;

    const newPerms = {
      ...selectedMember.permissions,
      [permKey]: !selectedMember.permissions[permKey],
    };

    // Optimistic update
    const updatedMember = {
      ...selectedMember,
      permissions: newPerms,
      isCustomized: true,
    };
    setSelectedMember(updatedMember);
    setMembers((prev) =>
      prev.map((m) => (m.userId === selectedMember.userId ? updatedMember : m))
    );

    setIsSaving(true);
    try {
      const res = await teamService.updateMemberPermissions(
        team.id,
        selectedMember.userId,
        newPerms
      );
      if (res.success) {
        toast.success(
          'Permission updated',
          `${selectedMember.name}'s permissions have been updated.`
        );
      } else {
        toast.error('Failed to update permission', res.error);
      }
    } catch (err: any) {
      toast.error('Failed to update permission', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-[#0E0E11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-[#121318]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/30 border border-purple-700/50 flex items-center justify-center text-purple-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Team Role & Permissions (RBAC)
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Owner Only
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure explicit permissions for team members. Changes take effect immediately.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body: Left Member Picker, Right Permission Toggles */}
        <div className="flex-1 flex overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-12">
              <Loader2 size={28} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              {/* Member Selection List */}
              <div className="w-72 border-r border-zinc-800/80 bg-[#090A0D] overflow-y-auto p-3 space-y-1.5 custom-scrollbar flex-shrink-0">
                <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Team Members ({members.length})
                </div>
                {members.map((m) => {
                  const isSelected = selectedMember?.userId === m.userId;
                  return (
                    <button
                      key={m.userId}
                      onClick={() => setSelectedMember(m)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-purple-600/15 border border-purple-500/40 text-zinc-100 shadow'
                          : 'hover:bg-zinc-800/40 text-zinc-400 border border-transparent'
                      }`}
                    >
                      <div className="relative">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                            style={{ backgroundColor: m.avatarColor || '#8B5CF6' }}
                          >
                            {m.name[0].toUpperCase()}
                          </div>
                        )}
                        {m.isOwner && (
                          <Crown
                            size={12}
                            className="absolute -top-1 -right-1 text-amber-400 fill-amber-400"
                          />
                        )}
                      </div>
                      <div className="truncate flex-1">
                        <div className="text-xs font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                          <span>{m.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">{m.role}</p>
                      </div>
                      {m.isCustomized && !m.isOwner && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Customized" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Permissions Checklist Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0E0E11]">
                {selectedMember ? (
                  <>
                    {/* Selected Member Header Card */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#14151B] border border-zinc-800">
                      <div className="flex items-center gap-3">
                        {selectedMember.avatarUrl ? (
                          <img
                            src={selectedMember.avatarUrl}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/30"
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shadow"
                            style={{ backgroundColor: selectedMember.avatarColor || '#8B5CF6' }}
                          >
                            {selectedMember.name[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                            {selectedMember.name}
                            {selectedMember.isOwner && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Crown size={11} /> Owner
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-zinc-400">{selectedMember.email}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-zinc-400 font-medium block">
                          Assigned Role
                        </span>
                        <span className="text-xs font-semibold text-purple-400">
                          {selectedMember.role}
                        </span>
                      </div>
                    </div>

                    {/* Notice for Owner */}
                    {selectedMember.isOwner && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        <Crown size={16} className="flex-shrink-0" />
                        <span>
                          The Team Owner retains all permissions at all times. Owner permissions
                          cannot be restricted.
                        </span>
                      </div>
                    )}

                    {/* Permissions Toggle List */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Configurable Permissions
                      </h5>

                      <div className="grid grid-cols-1 gap-2.5">
                        {PERMISSION_CONFIG.map((perm) => {
                          const isEnabled = selectedMember.isOwner
                            ? true
                            : Boolean(selectedMember.permissions[perm.key]);

                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                                isEnabled
                                  ? 'bg-[#15161E] border-purple-500/30'
                                  : 'bg-[#111216] border-zinc-800/80 opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                  {perm.icon}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-zinc-200">{perm.label}</p>
                                  <p className="text-[11px] text-zinc-400">{perm.description}</p>
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={selectedMember.isOwner || isSaving}
                                onClick={() => handleToggle(perm.key)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${
                                  isEnabled ? 'bg-purple-600' : 'bg-zinc-800'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    isEnabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-zinc-500 text-xs">
                    Select a team member on the left to configure their permissions.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-[#121318]/50 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-purple-400" />
            <span>Strict Backend Enforcement: Unauthorized API requests are automatically rejected.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

