import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import DashboardShell from '@/components/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Fetch profile data if needed, or just pass basic user info
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

  return (
    <DashboardShell user={userData}>
      {children}
    </DashboardShell>
  )
}
