import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Vite exposes env vars prefixed with VITE_ at build time. The values come from
// the local .env file (gitignored). When they're missing — e.g. a fresh checkout
// or the hosted web build — the app runs in offline/demo mode with no client.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured: boolean = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE: the Android deep-link callback then carries ?code= (query),
        // which is reliable, instead of #access_token= (URL fragment), which
        // Android deep links can drop. The web popup flow handles PKCE too.
        flowType: 'pkce',
      },
    })
  : null
