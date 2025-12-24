import { Typography, Box } from '@mui/material'
import { createClient } from '@/utils/supabase/server'
import CreateOrganizationForm from './organizations/create-form'
import { cookies } from 'next/headers'
import EmptyCycleState from '@/components/dashboard/empty-cycle-state'
import ExecutionDashboard from '@/components/dashboard/execution-dashboard'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Check if user belongs to any organization
  const { data: memberships } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)

  const hasOrganization = memberships && memberships.length > 0

  if (!hasOrganization) {
    return <CreateOrganizationForm />
  }

  // Determine active org from cookie or default to first
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('execute_active_org')?.value
  
  // Verify the user is actually a member of the cookie org
  const currentOrgId = activeOrgId && memberships.some(m => m.org_id === activeOrgId) 
    ? activeOrgId 
    : memberships[0].org_id

  // Fetch Dashboard Data
  const { activeCycle, weeklyScore, todaysInstances, overdueInstances } = await getDashboardData(supabase, currentOrgId)

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Execution Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your lead indicators and execute your 12-week plan.
        </Typography>
      </Box>
      
      {!activeCycle ? (
        <EmptyCycleState />
      ) : (
        <ExecutionDashboard 
          activeCycle={activeCycle}
          weeklyScore={weeklyScore}
          todaysInstances={todaysInstances}
          overdueInstances={overdueInstances}
        />
      )}
    </Box>
  )
}
