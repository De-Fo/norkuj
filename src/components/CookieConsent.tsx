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
      border: '1px solid var(--c-border, #e2e8f0)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
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
          🍪 {t('_cookies_title')}
        </span>
        <span style={{ color: 'var(--c-muted, #64748b)' }}>
          {t('_cookies_text')}
          {' '}
          <a href={cookieUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--c-accent, #2563eb)', textDecoration: 'underline' }}>
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
            border: '1px solid var(--c-border, #e2e8f0)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--c-muted, #64748b)',
            fontSize: 13,
            fontWeight: 500,
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
            borderRadius: 8,
            background: 'var(--c-accent, #2563eb)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
          {t('_cookies_accept')}
        </button>
      </div>
    </div>
  )
}
