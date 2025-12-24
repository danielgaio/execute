'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // 1. Create Organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      created_by: user.id
    })
    .select()
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  // 2. Add Creator as Owner
  const { error: memberError } = await supabase
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner'
    })

  if (memberError) {
    // Cleanup org if member creation fails (optional but good practice)
    await supabase.from('organizations').delete().eq('id', org.id)
    return { error: memberError.message }
  }

  // 3. Set Active Org Cookie
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set('execute_active_org', org.id)

  // 4. Redirect
  const { redirect } = await import('next/navigation')
  redirect('/dashboard')
}
