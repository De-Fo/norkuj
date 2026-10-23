// Bump when terms/privacy text changes: a timestamp alone doesn't prove WHICH text was accepted.
// Everyone whose stored terms_version differs sees the one-time consent screen again.
export const TERMS_VERSION = '2026-10'
export const CONSENT_LS_KEY = 'norkuj-pending-consent'

export function consentPayload() {
  return { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }
}

export function hasCurrentConsent(meta: Record<string, unknown> | undefined | null): boolean {
  return Boolean(meta?.terms_accepted_at) && meta?.terms_version === TERMS_VERSION
}

// The stashed Google consent is only valid for one OAuth round trip: expire it so an abandoned attempt
// can never count as consent for whoever signs in on this browser later.
const PENDING_MAX_AGE_MS = 15 * 60 * 1000

export function readPendingConsent(): { terms_accepted_at: string; terms_version: string } | null {
  try {
    const raw = localStorage.getItem(CONSENT_LS_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    const age = Date.now() - new Date(c?.terms_accepted_at).getTime()
    if (!(age >= 0 && age <= PENDING_MAX_AGE_MS) || typeof c.terms_version !== 'string') {
      localStorage.removeItem(CONSENT_LS_KEY)
      return null
    }
    return { terms_accepted_at: c.terms_accepted_at, terms_version: c.terms_version }
  } catch { return null }
}

export function hasPendingConsent(): boolean {
  return readPendingConsent() !== null
}

// A password-reset link lands on '/' with #...type=recovery. Supabase clears the hash after reading it, so capture it at load.
export const OPENED_FROM_RECOVERY_LINK = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
