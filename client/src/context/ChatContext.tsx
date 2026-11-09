import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { useOrganization } from './OrganizationContext';
import { teamService } from '../services/team.service';
import { organizationService } from '../services/organization.service';
import { getSocketUrl } from '../config/api';
import type { TeamSummary, TeamConversation, TeamMessage } from '../types/team';
import type { OrganizationMember } from '../types/organization';

export type ChatCategory = 'org' | 'team' | 'direct';

interface ChatContextType {
  isOpen: boolean;
  isMinimized: boolean;
  openChat: (convId?: number, teamId?: number, category?: ChatCategory) => void;
  closeChat: () => void;
  toggleChat: () => void;
  minimizeChat: () => void;
  expandChat: () => void;
  activeConversation: TeamConversation | null;
  setActiveConversation: (conv: TeamConversation | null) => void;
  activeTeam: TeamSummary | null;
  setActiveTeam: (team: TeamSummary | null) => void;
  chatCategory: ChatCategory;
  setChatCategory: (cat: ChatCategory) => void;
  teams: TeamSummary[];
  orgTeam: TeamSummary | null;
  squadTeams: TeamSummary[];
  orgMembers: OrganizationMember[];
  unreadTotal: number;
  refreshUnread: () => void;
  socket: Socket | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeProject } = useNavigation();
  const { currentOrganization } = useOrganization();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatCategory, setChatCategory] = useState<ChatCategory>('team');
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMember[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamSummary | null>(null);
  const [activeConversation, setActiveConversation] = useState<TeamConversation | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  // Split teams into org team and squad teams
  const orgTeam = teams.find((t) => t.name.includes('(Organisation)') || t.name.includes('Workspace')) || teams[0] || null;
  const squadTeams = teams.filter((t) => !t.name.includes('(Organisation)') && !t.name.includes('Workspace'));

  // Load user teams and organization members
  const loadTeams = useCallback(async () => {
    try {
      const [teamsRes, membersRes] = await Promise.all([
        teamService.listTeams({
          organizationSlug: currentOrganization?.slug,
        }),
        currentOrganization?.slug
          ? organizationService.listMembers(currentOrganization.slug)
          : Promise.resolve({ success: false, data: [] }),
      ]);

      if (teamsRes.success && Array.isArray(teamsRes.data)) {
        setTeams(teamsRes.data);
        if (teamsRes.data.length > 0) {
          // If activeProject has a team, prioritize that team
          if (activeProject && (activeProject as any).teamId) {
            const projTeam = teamsRes.data.find((t) => t.id === (activeProject as any).teamId);
            if (projTeam) {
              setActiveTeam(projTeam);
              return;
            }
          }
          setActiveTeam((prev) => prev || teamsRes.data![0]);
        }
      }

      if (membersRes.success && Array.isArray(membersRes.data)) {
        setOrgMembers(membersRes.data);
      }
    } catch (err) {
      console.warn('Failed to fetch teams/members for chat:', err);
    }
  }, [currentOrganization?.slug, activeProject]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Compute total unreads across all conversations in active team
  const refreshUnread = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const res = await teamService.getConversations(activeTeam.id);
      if (res.success && res.data) {
        const total = res.data.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadTotal(total);
      }
    } catch {
      // silent
    }
  }, [activeTeam]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  // Socket setup
  useEffect(() => {
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    socketRef.current = socket;

    if (user?.id) {
      socket.emit('join_user', user.id);
    }
    if (activeTeam?.id) {
      socket.emit('join_team', activeTeam.id);
    }

    socket.on('new_message', () => {
      refreshUnread();
    });

    return () => {
      if (activeTeam?.id) {
        socket.emit('leave_team', activeTeam.id);
      }
      socket.disconnect();
    };
  }, [user?.id, activeTeam?.id, refreshUnread]);

  // Event listener for devflow:toggle-chat-drawer
  useEffect(() => {
    const handleToggleEvent = (e: any) => {
      const detail = e.detail;
      setIsOpen((prev) => !prev);
      setIsMinimized(false);
      if (detail?.teamId) {
        const found = teams.find((t) => t.id === detail.teamId);
        if (found) setActiveTeam(found);
      }
    };

    window.addEventListener('devflow:toggle-chat-drawer', handleToggleEvent);
    return () => window.removeEventListener('devflow:toggle-chat-drawer', handleToggleEvent);
  }, [teams]);

  // Global Keyboard Shortcuts (Ctrl+Shift+C / Cmd+Shift+C, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Escape closes or minimizes
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsMinimized(false);
        return;
      }

      // Ctrl+Shift+M (or Cmd+Shift+M / Ctrl+Shift+C) toggles drawer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'c')) {
        if (!isInput) {
          e.preventDefault();
          setIsOpen((prev) => !prev);
          setIsMinimized(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openChat = useCallback((convId?: number, teamId?: number, category?: ChatCategory) => {
    setIsOpen(true);
    setIsMinimized(false);
    if (category) {
      setChatCategory(category);
    }
    if (teamId) {
      const found = teams.find((t) => t.id === teamId);
      if (found) {
        setActiveTeam(found);
        if (!category) {
          if (found.name.includes('(Organisation)') || found.name.includes('Workspace')) {
            setChatCategory('org');
          } else {
            setChatCategory('team');
          }
        }
      }
    } else if (category === 'org' && orgTeam) {
      setActiveTeam(orgTeam);
    }
  }, [teams, orgTeam]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
    setIsMinimized(false);
  }, []);

  const minimizeChat = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const expandChat = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        isMinimized,
        openChat,
        closeChat,
        toggleChat,
        minimizeChat,
        expandChat,
        activeConversation,
        setActiveConversation,
        activeTeam,
        setActiveTeam,
        chatCategory,
        setChatCategory,
        teams,
        orgTeam,
        squadTeams,
        orgMembers,
        unreadTotal,
        refreshUnread,
        socket: socketRef.current,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
