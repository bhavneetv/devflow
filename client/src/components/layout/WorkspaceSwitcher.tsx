import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Plus,
  Settings,
  UserPlus,
  Building2,
  Search,
  ExternalLink,
  Users,
  LogIn,
} from 'lucide-react';
import { useOrganization } from '../../context/OrganizationContext';
import { useAccentTheme } from '../../services/accentTheme.service';
import { OrgAvatar } from '../organization/OrgAvatar';

interface WorkspaceSwitcherProps {
  onClose: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onClose }) => {
  const {
    organizations,
    currentOrganization,
    switchOrganization,
    setIsCreateModalOpen,
    setIsJoinModalOpen,
  } = useOrganization();
  const { accentColor } = useAccentTheme();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectOrg = (slug: string) => {
    switchOrganization(slug);
    onClose();
  };

  const handleOpenSettings = () => {
    if (currentOrganization) {
      navigate(`/organizations/${currentOrganization.slug}/settings`);
    }
    onClose();
  };

  const handleOpenMembers = () => {
    if (currentOrganization) {
      navigate(`/organizations/${currentOrganization.slug}/members`);
    }
    onClose();
  };

  const handleCreateNew = () => {
    onClose();
    setIsCreateModalOpen(true);
  };

  return (
    <div className="absolute top-12 left-2 right-2 z-50 bg-[#141519] border border-[#27272A] rounded-xl shadow-2xl py-1.5 text-xs text-zinc-300 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl max-h-[420px] flex flex-col">
      {/* Header Label */}
      <div className="px-3 pt-1 pb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
        <span>Organizations</span>
        <span className="text-zinc-500">{organizations.length}</span>
      </div>

      {/* Search Input if multiple organizations */}
      {organizations.length > 2 && (
        <div className="px-2 pb-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search organizations..."
              className="w-full h-7 pl-7 pr-2.5 rounded-lg bg-[#0C0D10] border border-[#27272A] text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Organization List */}
      <div className="space-y-0.5 px-1 py-0.5 overflow-y-auto max-h-48 scrollbar-thin scrollbar-thumb-zinc-700">
        {filteredOrgs.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-zinc-500">
            No organizations match "{searchQuery}"
          </div>
        ) : (
          filteredOrgs.map((org) => {
            const isActive = currentOrganization?.id === org.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org.slug)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1F2128] text-white font-medium shadow-sm'
                    : 'hover:bg-white/[0.05] text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate min-w-0">
                  <OrgAvatar
                    name={org.name}
                    logoUrl={org.logoUrl}
                    className="w-6 h-6"
                    iconSize={13}
                    roundedClassName="rounded-md"
                  />
                  <div className="truncate min-w-0">
                    <div className="text-[13px] leading-tight truncate font-medium">
                      {org.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5 truncate">
                      {org.currentUserRole || 'MEMBER'} · {org.slug}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    style={{ color: accentColor }}
                    className="shrink-0 ml-1.5"
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="my-1 border-t border-[#27272A]" />

      {/* Actions */}
      <div className="space-y-0.5 px-1">
        {currentOrganization && (
          <>
            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.05] text-zinc-300 transition-colors cursor-pointer"
            >
              <Settings size={13.5} className="text-zinc-400" />
              <span className="text-[12px]">Organization settings</span>
            </button>

            <button
              onClick={handleOpenMembers}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.05] text-zinc-300 transition-colors cursor-pointer"
            >
              <Users size={13.5} className="text-zinc-400" />
              <span className="text-[12px]">Manage members & invites</span>
            </button>
          </>
        )}

        <button
          onClick={handleCreateNew}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.05] text-zinc-200 transition-colors cursor-pointer"
        >
          <Plus size={13.5} style={{ color: accentColor }} />
          <span className="text-[12px] font-medium" style={{ color: accentColor }}>
            Create new organization
          </span>
        </button>

        <button
          onClick={() => {
            onClose();
            setIsJoinModalOpen(true);
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/[0.05] text-zinc-300 hover:text-white transition-colors cursor-pointer"
        >
          <LogIn size={13.5} className="text-zinc-400" />
          <span className="text-[12px]">
            Join an organization
          </span>
        </button>
      </div>
    </div>
  );
};
