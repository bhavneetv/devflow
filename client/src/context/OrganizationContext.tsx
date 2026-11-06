import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { organizationService } from '../services/organization.service';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type {
  Organization,
  OrganizationRole,
  CreateOrganizationInput,
} from '../types/organization';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentRole: OrganizationRole | null;
  isOwner: boolean;
  isAdminOrOwner: boolean;
  isLoading: boolean;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  isJoinModalOpen: boolean;
  setIsJoinModalOpen: (open: boolean) => void;
  switchOrganization: (slug: string) => Promise<void>;
  refreshOrganizations: () => Promise<Organization[]>;
  reloadCurrentOrganization: () => Promise<void>;
  createOrganization: (input: CreateOrganizationInput) => Promise<{ success: boolean; data?: Organization; error?: string }>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ACTIVE_ORG_KEY = 'devflow_active_org_slug';

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);

  // Extract orgSlug from current pathname if URL is /organizations/:organizationSlug/...
  const pathOrgSlugMatch = location.pathname.match(/^\/organizations\/([^/]+)/);
  const routeOrgSlug = pathOrgSlugMatch ? pathOrgSlugMatch[1] : null;

  const currentRole: OrganizationRole | null = currentOrganization?.currentUserRole || null;
  const isOwner = currentRole === 'OWNER';
  const isAdminOrOwner = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // Load organizations for authenticated user
  const refreshOrganizations = useCallback(async (): Promise<Organization[]> => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setIsLoading(false);
      return [];
    }

    try {
      const res = await organizationService.listOrganizations();
      if (res.success && Array.isArray(res.data)) {
        setOrganizations(res.data);
        return res.data;
      }
      return [];
    } catch (err) {
      console.error('Failed to load organizations:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch and organization selection on auth change
  useEffect(() => {
    let isMounted = true;

    const initOrgs = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const orgList = await refreshOrganizations();
      if (!isMounted) return;

      if (orgList.length === 0) {
        setCurrentOrganization(null);
        setIsLoading(false);
        return;
      }

      // Priority 1: Match from URL if present
      if (routeOrgSlug) {
        const matched = orgList.find((o) => o.slug.toLowerCase() === routeOrgSlug.toLowerCase());
        if (matched) {
          setCurrentOrganization(matched);
          try { localStorage.setItem(ACTIVE_ORG_KEY, matched.slug); } catch {}
          setIsLoading(false);
          return;
        }
      }

      // Priority 2: Last saved organization in localStorage
      let savedSlug: string | null = null;
      try { savedSlug = localStorage.getItem(ACTIVE_ORG_KEY); } catch {}

      if (savedSlug) {
        const matched = orgList.find((o) => o.slug.toLowerCase() === savedSlug?.toLowerCase());
        if (matched) {
          setCurrentOrganization(matched);
          setIsLoading(false);
          return;
        }
      }

      // Priority 3: First available organization
      const defaultOrg = orgList[0];
      setCurrentOrganization(defaultOrg);
      try { localStorage.setItem(ACTIVE_ORG_KEY, defaultOrg.slug); } catch {}
      setIsLoading(false);
    };

    initOrgs();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id, refreshOrganizations]);

  // Keep currentOrganization synchronized when URL route slug changes
  useEffect(() => {
    if (routeOrgSlug && organizations.length > 0) {
      if (!currentOrganization || currentOrganization.slug.toLowerCase() !== routeOrgSlug.toLowerCase()) {
        const matched = organizations.find((o) => o.slug.toLowerCase() === routeOrgSlug.toLowerCase());
        if (matched) {
          setCurrentOrganization(matched);
          try { localStorage.setItem(ACTIVE_ORG_KEY, matched.slug); } catch {}
        }
      }
    }
  }, [routeOrgSlug, organizations, currentOrganization]);

  // Reload details of current active organization
  const reloadCurrentOrganization = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      const res = await organizationService.getOrganization(currentOrganization.slug);
      if (res.success && res.data) {
        setCurrentOrganization(res.data);
        setOrganizations((prev) =>
          prev.map((o) => (o.id === res.data!.id ? { ...o, ...res.data! } : o))
        );
      }
    } catch (err) {
      console.error('Failed to reload active organization:', err);
    }
  }, [currentOrganization]);

  // Switch active organization
  const switchOrganization = async (targetSlug: string) => {
    const matched = organizations.find((o) => o.slug.toLowerCase() === targetSlug.toLowerCase());
    if (matched) {
      setCurrentOrganization(matched);
      try { localStorage.setItem(ACTIVE_ORG_KEY, matched.slug); } catch {}
      navigate(`/organizations/${matched.slug}/overview`);
      toast.success(`Switched to ${matched.name}`);
    } else {
      // Try fetching from server in case user recently joined
      const res = await organizationService.getOrganization(targetSlug);
      if (res.success && res.data) {
        setCurrentOrganization(res.data);
        setOrganizations((prev) => [res.data!, ...prev.filter((o) => o.id !== res.data!.id)]);
        try { localStorage.setItem(ACTIVE_ORG_KEY, res.data.slug); } catch {}
        navigate(`/organizations/${res.data.slug}/overview`);
        toast.success(`Switched to ${res.data.name}`);
      } else {
        toast.error('Organization not found', res.error);
      }
    }
  };

  // Create new organization and switch to it
  const createOrganization = async (input: CreateOrganizationInput) => {
    const res = await organizationService.createOrganization(input);
    if (res.success && res.data) {
      const newOrg = res.data;
      setOrganizations((prev) => [newOrg, ...prev]);
      setCurrentOrganization(newOrg);
      try { localStorage.setItem(ACTIVE_ORG_KEY, newOrg.slug); } catch {}
      setIsCreateModalOpen(false);
      navigate(`/organizations/${newOrg.slug}/overview`);
      toast.success('Organization created!', `${newOrg.name} is ready.`);
      return { success: true, data: newOrg };
    }
    return { success: false, error: res.error || 'Failed to create organization' };
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        currentRole,
        isOwner,
        isAdminOrOwner,
        isLoading,
        isCreateModalOpen,
        setIsCreateModalOpen,
        isJoinModalOpen,
        setIsJoinModalOpen,
        switchOrganization,
        refreshOrganizations,
        reloadCurrentOrganization,
        createOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
