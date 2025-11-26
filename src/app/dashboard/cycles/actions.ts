'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function createCycle(formData: FormData) {
  const supabase = await createClient()
  
  const title = formData.get('title') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization (assuming single org for MVP)
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return { error: 'No organization found' }
  }

  const { error } = await supabase
    .from('cycles')
    .insert({
      org_id: membership.org_id,
      owner_user_id: user.id,
      title,
      start_date: startDate,
      end_date: endDate,
      status: 'active'
    })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
