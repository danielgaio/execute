import { Typography, Paper, Box, Button, Stack } from '@mui/material'
import { createClient } from '@/utils/supabase/server'
import CreateOrganizationForm from './organizations/create-form'
import Link from 'next/link'
import { toggleInstanceStatus } from './actions'
import { getWeekStart } from '@/utils/planning'

interface TacticInstance {
  id: string
  status: string
  tactics: {
    title: string
    weight: number
  } | null
}

interface WeeklyInstance {
  id: string
  status: string
  tactics: {
    weight: number
  } | null
}

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

  // Fetch active cycle
  const { data: activeCycle } = await supabase
    .from('cycles')
    .select('*')
    .eq('org_id', memberships[0].org_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .single()

  // Fetch today's instances
  const today = new Date().toISOString().split('T')[0]
  const { data: todaysInstances } = await supabase
    .from('tactic_instances')
    .select(`
      *,
      tactics (
        title
      )
    `)
    .eq('org_id', memberships[0].org_id)
    .eq('due_date', today)
    .order('status', { ascending: false })

  // Calculate Weekly Score
  const weekStart = getWeekStart().toISOString().split('T')[0]
  const { data: weeklyInstances } = await supabase
    .from('tactic_instances')
    .select(`
      id,
      status,
      tactics (
        weight
      )
    `)
    .eq('org_id', memberships[0].org_id)
    .eq('week_start', weekStart)
    .eq('planned', true)

  let weeklyScore = 100
  if (weeklyInstances && weeklyInstances.length > 0) {
    let totalWeight = 0
    let completedWeight = 0
    
    ;(weeklyInstances as unknown as WeeklyInstance[]).forEach((instance) => {
      const weight = instance.tactics?.weight || 1.0
      totalWeight += weight
      if (instance.status === 'done') {
        completedWeight += weight
      }
    })

    if (totalWeight > 0) {
      weeklyScore = Math.round((completedWeight / totalWeight) * 100)
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome to Execute
      </Typography>
      <Typography paragraph>
        This is your dashboard. From here you can manage your 12-week cycles, goals, and tactics.
      </Typography>
      
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 2 }}>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 240 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Current Cycle
            </Typography>
            {activeCycle ? (
              <Box>
                <Typography variant="h5" gutterBottom>{activeCycle.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(activeCycle.start_date).toLocaleDateString()} - {new Date(activeCycle.end_date).toLocaleDateString()}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="body1" paragraph>
                  No active cycle found. Start planning your next 12 weeks!
                </Typography>
                <Link href="/dashboard/cycles/new" passHref>
                  <Button variant="contained" size="small">
                    Plan New Cycle
                  </Button>
                </Link>
              </Box>
            )}
          </Paper>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 240, overflow: 'auto' }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Today&apos;s Focus
            </Typography>
            {todaysInstances && todaysInstances.length > 0 ? (
              <Box>
                {todaysInstances.map((instance: TacticInstance) => (
                  <Box key={instance.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ textDecoration: instance.status === 'done' ? 'line-through' : 'none', color: instance.status === 'done' ? 'text.secondary' : 'text.primary' }}>
                      {instance.tactics?.title}
                    </Typography>
                    <form action={toggleInstanceStatus.bind(null, instance.id, instance.status)}>
                      <Button type="submit" size="small" variant={instance.status === 'done' ? 'outlined' : 'contained'} color={instance.status === 'done' ? 'secondary' : 'primary'} sx={{ minWidth: 60 }}>
                        {instance.status === 'done' ? 'Undo' : 'Done'}
                      </Button>
                    </form>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body1">
                You have no tactics due today.
              </Typography>
            )}
          </Paper>
        </Box>
        <Box sx={{ flex: 1, minWidth: 300 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 240 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Weekly Score
            </Typography>
            <Typography variant="h3" component="div" color={weeklyScore >= 85 ? 'success.main' : weeklyScore >= 60 ? 'warning.main' : 'error.main'}>
              {weeklyScore}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Lead Indicator Score
            </Typography>
          </Paper>
        </Box>
      </Stack>
    </Box>
  )
}
