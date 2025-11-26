'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function createGoal(formData: FormData) {
  const supabase = await createClient()
  
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const unit = formData.get('unit') as string
  const target = formData.get('target') as string
  const baseline = formData.get('baseline') as string

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { error: 'No organization found' }
  }

  // Get active cycle
  const { data: activeCycle } = await supabase
    .from('cycles')
    .select('id, end_date')
    .eq('org_id', membership.org_id)
    .eq('status', 'active')
    .single()

  if (!activeCycle) {
    return { error: 'No active cycle found. Please create a cycle first.' }
  }

  const { error } = await supabase
    .from('goals')
    .insert({
      org_id: membership.org_id,
      cycle_id: activeCycle.id,
      owner_user_id: user.id,
      title,
      description,
      unit,
      target: parseFloat(target),
      baseline: parseFloat(baseline || '0'),
      target_date: activeCycle.end_date, // Default to cycle end date
      status: 'on_track'
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/goals')
  redirect('/dashboard/goals')
}
