import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase keys in environment variables');
}

export const getAdminClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const getAnonClient = () => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createTestUser = async (email: string) => {
  const admin = getAdminClient();
  const password = 'test-password-123';
  
  // Clean up if exists
  // Note: In a real test env, we might want to truncate tables instead
  // but for now we'll just try to create.
  
  // Create user via admin API
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Test User' }
  });

  if (error) {
    // If user exists, try to sign in
    if (error.message.includes('already registered')) {
       const { data: signInData, error: signInError } = await getAnonClient().auth.signInWithPassword({
         email,
         password
       });
       if (signInError) throw signInError;
       
       const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${signInData.session?.access_token}` } },
        auth: { persistSession: false }
       });
       
       return { user: signInData.user!, client };
    }
    throw error;
  }

  // Sign in to get the token
  const { data: sessionData, error: sessionError } = await getAnonClient().auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError) throw sessionError;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionData.session?.access_token}` } },
    auth: { persistSession: false }
  });

  return { user: user.user, client };
};
