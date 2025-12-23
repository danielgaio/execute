"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export interface Organization {
  id: string;
  name: string;
  role?: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export function OrganizationProvider({
  children,
  initialOrgs = [],
  initialCurrentOrg = null,
}: {
  children: ReactNode;
  initialOrgs?: Organization[];
  initialCurrentOrg?: Organization | null;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrgs);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(
    initialCurrentOrg
  );
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const refreshOrgs = async () => {
    setIsLoading(true);
    try {
      const { data: members, error } = await supabase
        .from("org_members")
        .select("role, organizations(id, name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const orgs = members.map((m: any) => {
        const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
        return {
          id: org?.id,
          name: org?.name,
          role: m.role,
        };
      });

      setOrganizations(orgs);

      // If current org is not in the list (e.g. removed), switch to first
      if (currentOrg && !orgs.find((o) => o.id === currentOrg.id)) {
        if (orgs.length > 0) {
          setCurrentOrg(orgs[0]);
        } else {
          setCurrentOrg(null);
          router.push("/dashboard/organizations/new");
        }
      } else if (!currentOrg && orgs.length > 0) {
        setCurrentOrg(orgs[0]);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      // Optionally persist preference to local storage or DB profile
      localStorage.setItem("last_org_id", orgId);
    }
  };

  // Initial client-side check if needed (though we prefer server-side init)
  useEffect(() => {
    if (organizations.length === 0) {
      refreshOrgs();
    } else {
      // Check local storage for preference
      const lastOrgId = localStorage.getItem("last_org_id");
      if (lastOrgId && currentOrg?.id !== lastOrgId) {
        const preferredOrg = organizations.find((o) => o.id === lastOrgId);
        if (preferredOrg) {
          setCurrentOrg(preferredOrg);
        }
      }
    }
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        isLoading,
        switchOrg,
        refreshOrgs,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
