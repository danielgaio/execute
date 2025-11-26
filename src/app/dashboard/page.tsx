import { Typography, Paper, Box, Button } from '@mui/material'
import Grid from '@mui/material/Grid2';
import { createClient } from '@/utils/supabase/server'
import CreateOrganizationForm from './organizations/create-form'
import Link from 'next/link'

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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome to Execute
      </Typography>
      <Typography paragraph>
        This is your dashboard. From here you can manage your 12-week cycles, goals, and tactics.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
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
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 240 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Today's Focus
            </Typography>
            <Typography variant="body1">
              You have no tactics due today.
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 240 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Weekly Score
            </Typography>
            <Typography variant="h3" component="div">
              --%
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
