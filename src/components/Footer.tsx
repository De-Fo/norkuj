import { useState, useEffect } from 'react'
import { useLang } from '../lib/lang'

export function Footer() {
  const { t } = useLang()
  const [kofiOpen, setKofiOpen] = useState(false)

  useEffect(() => {
    if (!kofiOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKofiOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [kofiOpen])

  const link = (label: string, path: string) => (
    <a href={path} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--c-accent)', textDecoration: 'none', fontSize: 12 }}>
      {label}
    </a>
  )

  return (
    <footer style={{
      borderTop: '1px solid var(--c-border)',
      background: 'var(--c-surface)',
      padding: '24px 20px 16px',
      fontSize: 12,
      color: 'var(--c-muted)',
      flexShrink: 0,
    }}>
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'flex', flexWrap: 'wrap', gap: 16,
        justifyContent: 'space-between', alignItems: 'center',
      }}>
        {/* Left links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          {link(t('_footer_privacy'), '/privacy.html')}
          <span style={{ color: 'var(--c-faint)' }}>·</span>
          {link(t('_footer_cookies'), '/cookies.html')}
          <span style={{ color: 'var(--c-faint)' }}>·</span>
          {link(t('_footer_terms'), '/terms.html')}
          <span style={{ color: 'var(--c-faint)' }}>·</span>
          {link(t('_footer_consumer'), '/consumer-protection.html')}
        </div>

        {/* Right — social / support */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="https://github.com/De-Fo/norkuj" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--c-muted)', textDecoration: 'none', fontSize: 13 }}>
            GitHub
          </a>
          <span style={{ color: 'var(--c-faint)' }}>·</span>
          <a href="https://www.instagram.com/sebastian_glonek/" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--c-muted)', textDecoration: 'none', fontSize: 13 }}>
            Instagram
          </a>
          <span style={{ color: 'var(--c-faint)' }}>·</span>
          <button onClick={() => setKofiOpen(true)} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--c-accent)',
          }}>
            ☕ {t('_kofi_button')}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10, color: 'var(--c-faint)' }}>
        © {new Date().getFullYear()} {t('_copyright')}
        <span style={{ float: 'right' }}>{t('_made_by')} <strong>Sebastián Glonek</strong></span>
      </div>

      {/* ═══ Ko-fi donate modal ═══ */}
      {kofiOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setKofiOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 80, padding: 16,
          }}>
          <div style={{
            background: 'var(--c-surface)', borderRadius: 16,
            maxWidth: 440, width: '100%',
            maxHeight: '90vh', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            position: 'relative',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--c-border)',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>
                ☕ {t('_kofi_title')}
              </span>
              <button onClick={() => setKofiOpen(false)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: 'var(--c-bg)', cursor: 'pointer',
                  fontSize: 14, color: 'var(--c-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                ✕
              </button>
            </div>

            {/* Iframe */}
            <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 60px)' }}>
              <iframe
                src={`https://ko-fi.com/sebastianglonek/?hidefeed=true&widget=true&embed=true&preview=true`}
                style={{ border: 'none', width: '100%', padding: 4, background: '#f9f9f9' }}
                height={712}
                title="Ko-fi"
              />
              {/* Fallback link */}
              <div style={{ padding: '12px 18px 16px', textAlign: 'center' }}>
                <a
                  href={`https://ko-fi.com/sebastianglonek`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--c-accent)', fontSize: 13,
                    textDecoration: 'underline',
                  }}>
                  {t('_kofi_fallback')}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  )
}
