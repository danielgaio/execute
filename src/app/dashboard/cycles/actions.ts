'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { embeddingService } from '@/lib/agent/embedding-service'

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

  const { data: cycle, error } = await supabase
    .from('cycles')
    .insert({
      org_id: membership.org_id,
      owner_user_id: user.id,
      title,
      start_date: startDate,
      end_date: endDate,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Index the cycle for RAG
  try {
    await embeddingService.indexCycle(supabase, cycle, membership.org_id)
  } catch (err) {
    console.error('Failed to index cycle:', err)
    // Don't fail the request if indexing fails
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
