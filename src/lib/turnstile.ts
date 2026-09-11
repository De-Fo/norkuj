import { supabase } from './supabase'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

// verify a one-time Turnstile token server-side via the turnstile-verify Edge Function
export async function verifyTurnstile(token: string): Promise<{ ok: boolean }> {
  if (!SITE_KEY || !token) return { ok: true } // no key in dev / no token → pass open
  try {
    const { data, error } = await supabase.functions.invoke('turnstile-verify', { body: { token } })
    if (error) return { ok: false }
    return { ok: data?.ok === true }
  } catch {
    return { ok: false }
  }
}