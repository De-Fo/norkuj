// ── Unified error mapper ──
// Single source of truth: maps known errors to i18n keys, never raw text to users.
// Uses the existing t() function from lang.tsx. Always console.error the raw error
// behind import.meta.env.DEV for debug access.

import type { TFunction } from './lang'

// ── Context hints for error differentiation ──
// mapError can be called with an optional second t() call to differentiate
// same-backend-error contexts (e.g. "Invalid login credentials" in password
// change vs login flow).

/**
 * Map any caught error to a user-facing message via the app's i18n.
 *
 * Detection order:
 *  1. Postgres check-constraint violations (identified by constraint name in message)
 *  2. Postgres foreign-key or other constraint violations (generic catch)
 *  3. Supabase Auth errors (identified by code or known substrings)
 *  4. Network / unexpected errors (generic fallback)
 *
 * An optional `contextKey` is checked first for known contexts (e.g.
 * 'password_change') before falling through to the default detection.
 * Pass it when the same raw error string means different things in different
 * flows.
 *
 * The raw original error is always console.error'd behind import.meta.env.DEV
 * before returning the translated message, so debugging trace is never lost.
 */
export function mapError(e: unknown, t: TFunction, contextKey?: string): string {
  const msg = extractMessage(e)

  if (!msg) return t('_error_generic')

  if (import.meta.env.DEV) console.error('[mapError]', msg, e)

  // ── 0. Context-specific overrides ──
  if (contextKey === 'password_change' && msg.includes('Invalid login credentials')) {
    return t('_error_auth_wrong_password')
  }

  // ── 1. Postgres check-constraint violations ──
  // These come from the Supabase REST API: "new row for relation "listings" violates
  // check constraint "listings_title_check""
  if (msg.includes('listings_title_check')) return t('_error_title_length')
  if (msg.includes('listings_description_check')) return t('_error_desc_length')
  if (msg.includes('listings_price_czk_check')) return t('_error_price_invalid')
  if (msg.includes('listings_area_sqm_check')) return t('_error_area_range')

  // ── 2. Other Postgres constraint violations ──
  if (msg.includes('violates check constraint')) return t('_error_save_generic')
  if (msg.includes('violates foreign key')) return t('_error_save_generic')
  if (msg.includes('violates not-null')) return t('_error_save_generic')
  if (msg.includes('violates unique')) return t('_error_save_generic')

  // ── 3. Supabase Auth errors ──
  if (msg.includes('Invalid login credentials') || msg.includes('Email not confirmed')) return t('_error_auth_invalid')
  if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('User already registered')) return t('_error_auth_email_taken')
  if (msg.includes('Password should be at least') || msg.includes('password') && msg.includes('characters')) return t('_error_auth_weak_password')
  if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('For security purposes')) return t('_error_auth_rate_limit')
  if (msg.includes('reset_password_for_email') || msg.includes('already been sent')) return t('_error_auth_reset_limit')

  // ── 4. Network / generic ──
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Network request failed')) return t('_error_generic')

  // ── 5. Absolute last resort — still never raw e.message ──
  return t('_error_generic')
}

/**
 * Extract a string message from any thrown value.
 * Handles Error objects, {message} objects, string throws, etc.
 */
function extractMessage(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.error_description === 'string') return obj.error_description
  }
  return ''
}
