import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
// Prioritize .env.local, then .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnvAvailable = Boolean(SUPABASE_SERVICE_KEY && SUPABASE_ANON_KEY);

if (!supabaseEnvAvailable) {
  // Warn once so local/CI runs understand why RLS suites may be skipped
  console.warn('\x1b[33m%s\x1b[0m', 'Skipping Supabase RLS tests: missing Supabase keys (NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).');
}

export const getAdminClient = () => {
  if (!supabaseEnvAvailable) {
    throw new Error('Supabase test environment not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const getAnonClient = () => {
  if (!supabaseEnvAvailable) {
    throw new Error('Supabase test environment not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const createTestUser = async (email: string) => {
  if (!supabaseEnvAvailable) {
    throw new Error('Supabase test environment not configured');
  }
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
