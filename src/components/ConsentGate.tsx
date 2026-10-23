import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/lang'
import { Wordmark } from './Wordmark'
import { consentPayload } from '../lib/consent'

/**
 * One-time terms screen for signed-in users with no consent on record for the
 * current terms version (Google sign-ups, accounts created before the checkbox
 * existed, or after TERMS_VERSION is bumped). Accepting stores it in auth
 * metadata + profiles; declining signs the user out.
 */
export function ConsentGate({ user }: { user: User }) {
  const { t } = useLang()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const accept = async () => {
    if (!checked) { setErr(t('_auth_consent_required')); return }
    setBusy(true); setErr('')
    const consent = consentPayload()
    const { error } = await supabase.auth.updateUser({ data: consent })
    if (error) { setBusy(false); setErr(t('_consent_gate_error')); return }
    ;(supabase.from('profiles') as any).update(consent).eq('id', user.id).then(({ error: pErr }: any) => {
      if (pErr && import.meta.env.DEV) console.error('[consent profile mirror]', pErr)
    })
    // onAuthStateChange (USER_UPDATED) refreshes `user`, which unmounts this screen.
  }

  const link = { color: 'var(--c-accent)', textDecoration: 'none' } as const
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: 16 }}>
      <div style={{ marginBottom: 24 }}><Wordmark /></div>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--c-surface)', borderRadius: 4, padding: 24, boxShadow: '4px 4px 0 var(--c-border-md)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--c-text)' }}>{t('_consent_gate_title')}</h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-muted)', margin: '0 0 16px' }}>{t('_consent_gate_text')}</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.5, color: 'var(--c-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--c-accent)', cursor: 'pointer' }} />
          <span>
            {t('_auth_consent_prefix')}{' '}
            <a href={t('_auth_consent_terms_url')} target="_blank" rel="noopener noreferrer" style={link}>{t('_auth_consent_terms')}</a>{' '}
            {t('_auth_consent_and')}{' '}
            <a href={t('_auth_consent_privacy_url')} target="_blank" rel="noopener noreferrer" style={link}>{t('_auth_consent_privacy')}</a>,{' '}
            {t('_auth_consent_suffix')}
          </span>
        </label>
        {err && <div style={{ fontSize: 12, color: 'var(--c-red)', marginTop: 10 }}>{err}</div>}
        <button onClick={accept} disabled={busy || !checked}
          style={{ width: '100%', marginTop: 16, padding: '13px 0', border: 'none', borderRadius: 3, minHeight: 44, fontSize: 14, fontWeight: 600,
            background: checked ? 'var(--c-action)' : 'var(--c-border-md)', color: checked ? 'white' : 'var(--c-faint)', cursor: checked ? 'pointer' : 'not-allowed' }}>
          {busy ? '...' : t('_consent_gate_accept')}
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ width: '100%', marginTop: 8, padding: '10px 0', background: 'none', border: 'none', color: 'var(--c-muted)', fontSize: 12, cursor: 'pointer' }}>
          {t('_consent_gate_decline')}
        </button>
      </div>
    </div>
  )
}
