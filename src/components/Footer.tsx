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
      style={{ color: 'var(--c-text-secondary)', textDecoration: 'underline', textUnderlineOffset: 3, fontSize: 13 }}>
      {label}
    </a>
  )
  const social = (label: string, href: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pixel"
      style={{ color: 'var(--c-text)', textDecoration: 'none', fontSize: 15, borderBottom: '2px solid var(--c-text)', paddingBottom: 1 }}>
      {label}
    </a>
  )

  return (
    <footer style={{
      borderTop: '2px solid var(--c-text)',
      background: 'var(--c-surface)',
      padding: '28px 20px 16px',
      fontSize: 12,
      color: 'var(--c-muted)',
      flexShrink: 0,
    }}>
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 28,
      }}>
        {/* About: the pixel-font corner of the site */}
        <div>
          <div className="pixel" style={{ fontSize: 22, color: 'var(--c-text)', marginBottom: 8 }}>{t('_footer_about_title')}</div>
          <p className="pixel" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--c-text-secondary)', maxWidth: 440 }}>{t('_footer_about_text')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', marginTop: 14 }}>
            {social('GitHub', 'https://github.com/De-Fo/norkuj')}
            {social('Instagram', 'https://www.instagram.com/sebastian_glonek/')}
            <button onClick={() => setKofiOpen(true)} className="pixel btn-action"
              style={{ padding: '6px 12px', fontSize: 14 }}>
              {t('_kofi_button')} ☕
            </button>
          </div>
        </div>

        {/* Legal */}
        <nav aria-label="Legal" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          {link(t('_footer_privacy'), '/privacy.html')}
          {link(t('_footer_cookies'), '/cookies.html')}
          {link(t('_footer_terms'), '/terms.html')}
          {link(t('_footer_consumer'), '/consumer-protection.html')}
        </nav>
      </div>

      <div style={{ maxWidth: 960, margin: '20px auto 0', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', fontSize: 11, color: 'var(--c-faint)' }}>
        <span>© {new Date().getFullYear()} {t('_copyright')}</span>
        <span>{t('_made_by')} <strong style={{ color: 'var(--c-text-secondary)' }}>Sebastián Glonek</strong></span>
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
            background: 'var(--c-surface)', borderRadius: window.innerWidth < 768 ? 0 : 6,
            maxWidth: 440, width: '100%',
            maxHeight: window.innerWidth < 768 ? '100dvh' : '90vh',
            height: window.innerWidth < 768 ? '100dvh' : undefined,
            overflow: 'hidden',
            boxShadow: window.innerWidth < 768 ? 'none' : '6px 6px 0 var(--c-text)',
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
