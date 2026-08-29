import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  )
}

/**
 * The single Supabase client for the whole app. Never instantiate
 * `createClient` anywhere else — import this instance instead, so auth
 * session state and typed table access stay consistent everywhere.
 *
 * Only the public "anon" key belongs here. The service_role key must never
 * reach frontend code (see ARCHITECTURE.md — Segurança).
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
