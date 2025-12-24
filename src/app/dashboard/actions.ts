'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { generateInstancesForTacticId } from '@/lib/domain/planning'
import { getWeekStart } from '@/utils/planning'

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

export async function createOneOffTask(goalId: string, title: string, date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Get org_id from goal
  const { data: goal } = await supabase
    .from('goals')
    .select('org_id')
    .eq('id', goalId)
    .single()
  
  if (!goal) throw new Error('Goal not found')

  // Determine day of week (1=Monday, 7=Sunday)
  const d = new Date(date)
  const day = d.getDay() || 7 // JS getDay is 0=Sunday, we want 7=Sunday

  // Create Tactic
  const { data: tactic, error } = await supabase
    .from('tactics')
    .insert({
      org_id: goal.org_id,
      goal_id: goalId,
      title: title,
      recurrence: 'one_off',
      due_days: [day],
      assignee_user_id: user.id,
      status: 'active'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Generate Instance
  // We pass the week start of the selected date
  const weekStart = getWeekStart(new Date(date))
  await generateInstancesForTacticId(supabase, tactic.id, weekStart)

  revalidatePath('/dashboard')
}
