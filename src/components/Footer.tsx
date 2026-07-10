import { useLang } from '../lib/lang'

export function Footer() {
  const { t } = useLang()

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
          <button onClick={() => alert(t('_donate_alert'))} style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: 12, color: 'var(--c-accent)',
          }}>
            ☕ {t('_donate')}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 10, color: 'var(--c-faint)' }}>
        © {new Date().getFullYear()} {t('_copyright')}
        <span style={{ float: 'right' }}>{t('_made_by')} <strong>Sebastián Glonek</strong></span>
      </div>
    </footer>
  )
}
