import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveOrganization } from '@/lib/domain/organizations'
import { listOrgMembers } from '@/lib/domain/teams'
import { listPendingInvitations } from '@/lib/domain/invitations'
import SettingsTabs from '@/components/dashboard/settings-tabs'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profileData = {
    id: user.id,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    email: user.email || '',
    timezone: profile?.timezone || 'UTC',
    locale: profile?.locale || 'en',
  }

  // Get active organization
  const activeOrg = await getActiveOrganization(user.id)
  
  // Get organization data and members if user has an active org
  let orgData = null
  let orgMembers: any[] = []
  let pendingInvitations: any[] = []
  
  if (activeOrg) {
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', activeOrg.id)
      .single()
    
    orgData = org

    // Get organization members
    const members = await listOrgMembers(activeOrg.id)
    orgMembers = members.data || []

    // Get pending invitations (only if user is manager/owner)
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', activeOrg.id)
      .eq('user_id', user.id)
      .single()
    
    if (orgMember?.role === 'owner' || orgMember?.role === 'manager') {
      const invitations = await listPendingInvitations(activeOrg.id)
      pendingInvitations = invitations.data || []
    }
  }

  return (
    <SettingsTabs
      profile={profileData}
      organization={orgData}
      orgMembers={orgMembers}
      pendingInvitations={pendingInvitations}
    />
  )
}
