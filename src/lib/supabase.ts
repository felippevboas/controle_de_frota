import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : null) || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : null) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
