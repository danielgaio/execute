'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { embeddingService } from '@/lib/agent/embedding-service'

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

  const { data: goal, error } = await supabase
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
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Index the goal for RAG
  try {
    await embeddingService.indexGoal(supabase, goal, membership.org_id)
  } catch (err) {
    console.error('Failed to index goal:', err)
  }

  revalidatePath('/dashboard/goals')
  redirect('/dashboard/goals')
}

export async function updateGoalMeasurement(goalId: string, value: number, notes?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Verify ownership/membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: 'No organization found' }

  // Insert measurement
  const { error: measurementError } = await supabase
    .from('goal_measurements')
    .insert({
      goal_id: goalId,
      org_id: membership.org_id,
      value: value,
      notes: notes,
      created_by: user.id
    })

  if (measurementError) return { error: measurementError.message }

  // Trigger updates goal.current_value automatically via DB trigger, 
  // but we revalidate to show changes in UI
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/goals')
  
  return { success: true }
}
