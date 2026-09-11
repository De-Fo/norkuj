import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

// Inline Turnstile widget; managed mode auto-solves for low-risk visitors.
// Token is single-use, so a fresh `resetKey` re-rolls it after a submit.
// No-ops when no site key (dev).
export function TurnstileWidget({ action, resetKey, onToken, onReady, onError }: {
  action: string
  resetKey?: unknown
  onToken: (token: string) => void
  onReady?: () => void
  onError?: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const tokenCb = useRef(onToken)
  tokenCb.current = onToken
  const readyCb = useRef(onReady)
  readyCb.current = onReady
  const widgetRef = useRef<string | undefined>(undefined)
  const lastReset = useRef(resetKey)
  const resetKeyChanged = lastReset.current !== resetKey
  lastReset.current = resetKey

  useEffect(() => {
    if (!SITE_KEY) return
    const el = ref.current
    if (!el) return

    const render = () => {
      const tw = window.turnstile
      if (!tw) return
      widgetRef.current = tw.render(el, {
        sitekey: SITE_KEY,
        action,
        callback: (token: string) => { tokenCb.current(token); readyCb.current?.() },
        'error-callback': onError,
        'expired-callback': onError,
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = render
      s.onerror = () => { /* script could not load (offline/throttled) — enable button so auth isn't bricked */ readyCb.current?.() }
      document.head.appendChild(s)
    }
  }, [action])

  // Re-roll the challenge when a submit consumes the one-time token.
  useEffect(() => {
    if (!resetKeyChanged || !SITE_KEY) return
    const id = widgetRef.current
    if (id) window.turnstile?.reset(id)
  }, [resetKey, resetKeyChanged])

  useEffect(() => () => { if (widgetRef.current) window.turnstile?.remove(widgetRef.current) }, [])

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minWidth: 300, minHeight: 65 }} />
}