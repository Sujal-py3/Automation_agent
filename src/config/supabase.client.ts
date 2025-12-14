import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;


export const getSupabase = () => {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables not loaded');
    }

    console.log('Initializing Supabase client with:');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY.substring(0, 10) + '...');

    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );
  }
  return supabase;
};
