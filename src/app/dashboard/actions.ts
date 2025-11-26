'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function toggleInstanceStatus(instanceId: string, currentStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const newStatus = currentStatus === 'done' ? 'pending' : 'done'
  const completedAt = newStatus === 'done' ? new Date().toISOString() : null

  const { error } = await supabase
    .from('tactic_instances')
    .update({ 
      status: newStatus,
      completed_at: completedAt
    })
    .eq('id', instanceId)

  if (error) throw new Error('Failed to update status')

  revalidatePath('/dashboard')
}
