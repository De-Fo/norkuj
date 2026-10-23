import { useEffect, useState } from 'react'
import { useLang } from '../lib/lang'
import { loadGoogleAnalytics } from '../lib/analytics'

const STORAGE_KEY = 'norkuj-cookie-consent'
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000  // 1 year (GDPR best practice)

type ConsentStatus = 'accepted' | 'rejected'

interface ConsentRecord {
  status: ConsentStatus
  timestamp: number  // Date.now()
}

function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentRecord
    if (parsed.status !== 'accepted' && parsed.status !== 'rejected') return null
    if (typeof parsed.timestamp !== 'number') return null
    // Expired?
    if (Date.now() - parsed.timestamp > CONSENT_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeConsent(status: ConsentStatus) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, timestamp: Date.now() }))
}

export function CookieConsent() {
  const { t, lang } = useLang()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const existing = readConsent()
    if (!existing) {
      setVisible(true)
    } else if (existing.status === 'accepted') {
      // Reloading visitor who already accepted → load GA without showing banner
      const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
      if (gaId) loadGoogleAnalytics(gaId)
    }
    // If rejected → nothing loads, banner stays hidden
  }, [])

  const accept = () => {
    writeConsent('accepted')
    setVisible(false)
    const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
    if (gaId) loadGoogleAnalytics(gaId)
  }

  const reject = () => {
    writeConsent('rejected')
    setVisible(false)
    // GA never loads
  }

  if (!visible) return null

  const cookieUrl = lang === 'en' ? '/cookies.en.html' : '/cookies.html'

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 16,
      right: 16,
      maxWidth: 640,
      margin: '0 auto',
      zIndex: 9999,
      background: 'var(--c-surface, #fff)',
      border: '2px solid var(--c-text)',
      borderRadius: 3,
      boxShadow: '4px 4px 0 var(--c-text)',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      fontSize: 13,
      lineHeight: 1.5,
      color: 'var(--c-text, #0f172a)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>
          {t('_cookies_title')}
        </span>
        <span style={{ color: 'var(--c-muted, #64748b)' }}>
          {t('_cookies_text')}
          {' '}
          <a href={cookieUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--c-accent)', textDecoration: 'underline' }}>
            {t('_cookies_link')}
          </a>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={reject}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '10px 0',
            border: 'none',
            borderRadius: 3,
            // same size and weight as "Accept": rejecting must be as easy and visible as accepting
            background: 'var(--c-text)',
            color: 'var(--c-bg)',
            boxShadow: '0 2px 0 var(--c-border-md)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
          {t('_cookies_reject')}
        </button>
        <button onClick={accept}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '10px 0',
            border: 'none',
            borderRadius: 3,
            background: 'var(--c-action)',
            color: '#fff',
            boxShadow: '0 2px 0 var(--c-action-step)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
          {t('_cookies_accept')}
        </button>
      </div>
    </div>
  )
}
