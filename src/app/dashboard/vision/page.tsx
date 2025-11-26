import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VisionForm from './vision-form'

export default async function VisionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  // Get existing vision
  const { data: vision } = await supabase
    .from('visions')
    .select('content_md')
    .eq('org_id', membership.org_id)
    .eq('user_id', user.id)
    .single()

  return <VisionForm initialContent={vision?.content_md || ''} />
}
