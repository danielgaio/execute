'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function switchOrganization(orgId: string) {
  const cookieStore = await cookies()
  cookieStore.set('execute_active_org', orgId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    httpOnly: true,
  })
  revalidatePath('/dashboard')
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
