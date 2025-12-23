import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardShell from '@/components/dashboard-shell'
import { OrganizationProvider } from '@/contexts/organization-context'
import { cookies } from 'next/headers'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('execute_active_org')?.value

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const userData = {
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name,
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
  }

  // Fetch User's Organizations
  const { data: members } = await supabase
    .from('org_members')
    .select('role, organizations(id, name)')
    .eq('user_id', user.id)

  const organizations = members?.map((m: any) => {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations
    return {
      id: org?.id,
      name: org?.name,
      role: m.role,
    }
  }) || []

  // Handle Onboarding: If no orgs, and not already on the create page
  // Note: We can't easily check the current path in a layout without headers/middleware tricks
  // So we'll let the client component handle the redirect if the list is empty,
  // OR we assume if they are accessing /dashboard/* they need an org.
  // However, /dashboard/organizations/new is a valid path for 0 orgs.
  // We will handle the redirect logic in the page or middleware, but for now,
  // we pass the data to the provider.

  // Determine initial active org
  let initialCurrentOrg = null
  if (organizations.length > 0) {
    if (activeOrgId) {
      initialCurrentOrg = organizations.find((o: any) => o.id === activeOrgId) || organizations[0]
    } else {
      initialCurrentOrg = organizations[0]
    }
  }

  return (
    <OrganizationProvider 
      initialOrgs={organizations} 
      initialCurrentOrg={initialCurrentOrg}
    >
      <DashboardShell user={userData}>
        {children}
      </DashboardShell>
    </OrganizationProvider>
  )
}
