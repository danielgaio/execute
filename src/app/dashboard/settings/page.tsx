import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SettingsForm from './settings-form'

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
    full_name: profile?.full_name || user.user_metadata?.full_name,
    email: user.email,
    timezone: profile?.timezone || 'UTC',
    locale: profile?.locale || 'en',
  }

  return <SettingsForm profile={profileData} />
}
