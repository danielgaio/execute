'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { embeddingService } from '@/lib/agent/embedding-service'

export async function saveVision(formData: FormData) {
  const supabase = await createClient()
  
  const content = formData.get('content') as string

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

  // Check if user already has a vision
  const { data: existingVision } = await supabase
    .from('visions')
    .select('id, version')
    .eq('org_id', membership.org_id)
    .eq('user_id', user.id)
    .single()

  if (existingVision) {
    // Update existing vision with new version
    const { data: updatedVision, error } = await supabase
      .from('visions')
      .update({
        content_md: content,
        version: existingVision.version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingVision.id)
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }
    
    // Index updated vision
    try {
      await embeddingService.indexVision(supabase, updatedVision, membership.org_id)
    } catch (err) {
      console.error('Failed to index vision:', err)
    }
  } else {
    // Create new vision
    const { data: newVision, error } = await supabase
      .from('visions')
      .insert({
        org_id: membership.org_id,
        user_id: user.id,
        content_md: content,
        version: 1
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }
    
    // Index new vision
    try {
      await embeddingService.indexVision(supabase, newVision, membership.org_id)
    } catch (err) {
      console.error('Failed to index vision:', err)
    }
  }

  revalidatePath('/dashboard/vision')
  return { success: true }
}
