import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { TERMS_VERSION, CONSENT_LS_KEY, consentPayload } from '../lib/consent'


const SITE_KEY_ACTIVE = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)

type Mode = 'login' | 'register' | 'reset'

const inp: React.CSSProperties = {
  width: '100%', padding: '12px', border: '1px solid var(--c-border)',
  borderRadius: 3, fontSize: 16, color: 'var(--c-text)', background: 'var(--c-surface)', outline: 'none',
}

interface Props {
  onBack: () => void
}

export function AuthPage({ onBack }: Props) {
  const { t } = useLang()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const captchaTokenRef = useRef('')
  const setCaptchaToken = (tok: string) => { captchaTokenRef.current = tok }
  const [captchaReady, setCaptchaReady] = useState(false)
  const [captchaEpoch, setCaptchaEpoch] = useState(0)

  // Detect Supabase password-recovery redirect (#access_token=...&type=recovery)
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setRecoveryMode(true)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async () => {
    const captchaToken = captchaTokenRef.current
    // Only block on captcha when the site key is actually provisioned. If the
    // widget never produced a token (script blocked / throttled / offline), let
    // the request through so auth isn't bricked on a flaky network.
    if (mode === 'register' && !agreed) { setMsg({ ok: false, text: t('_auth_consent_required') }); return }
    if (SITE_KEY_ACTIVE && !captchaToken) { setMsg({ ok: false, text: t('_captcha_pending') }); return }
    setCaptchaReady(false) // the token below is single-use; re-roll for a retry
    setCaptchaEpoch(e => e + 1)
    setLoading(true); setMsg(null)
    try {
    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, phone, terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }, captchaToken },
      })
      if (error) { setMsg({ ok: false, text: mapError(error, t) }); setLoading(false); return }
      if (data?.user) {
        await supabase.from('profiles').upsert(
          [{ id: data.user.id, display_name: displayName, phone, email, terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }] as any,
          { onConflict: 'id', ignoreDuplicates: false }
        )
        setMsg({ ok: true, text: t('_auth_register_success') })
      }
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      })
      if (error) setMsg({ ok: false, text: mapError(error, t) })
    } else if (mode === 'reset') {
      const resetRedirect = window.location.origin + '/'
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        captchaToken,
        redirectTo: resetRedirect,
      })
      if (error) {
        console.error('[resetPasswordForEmail]', error)
        setMsg({ ok: false, text: mapError(error, t) })
      } else {
        setMsg({ ok: true, text: t('_auth_reset_sent') })
      }
    }
    setLoading(false)
    } catch (e: unknown) {
      setLoading(false)
      setMsg({ ok: false, text: mapError(e, t) })
    }
  }

  const handleUpdatePassword = async () => {
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) { setMsg({ ok: false, text: mapError(error, t) }); return }
    setMsg({ ok: true, text: t('_auth_password_changed') })
    setTimeout(() => {
      window.location.hash = ''
      setRecoveryMode(false)
      onBack()
    }, 1200)
  }

  // Google never blocks on the checkbox: one button covers login and signup. If the box was ticked on
  // the register tab we stash it so App.tsx records it after the redirect; otherwise the one-time
  // ConsentGate asks for it after the first Google sign-in.
  const handleGoogle = () => {
    if (mode === 'register' && agreed) {
      try { localStorage.setItem(CONSENT_LS_KEY, JSON.stringify(consentPayload())) } catch { /* private mode */ }
    }
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const canSubmit = (!SITE_KEY_ACTIVE || captchaReady) && (mode !== 'register' || agreed)

  if (recoveryMode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: 16 }}>
        <div onClick={onBack} style={{ cursor: 'pointer', marginBottom: 24 }}>
          <Wordmark />
        </div>
        <div style={{ width: '100%', maxWidth: 380, background: 'var(--c-surface)', borderRadius: 5, padding: 24, boxShadow: '4px 4px 0 var(--c-border-md)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{t('_auth_reset_title')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={inp} placeholder={t('_auth_newpassword_placeholder')} type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()} />
            {msg && <div style={{ fontSize: 12, color: msg.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{msg.text}</div>}
            <button onClick={handleUpdatePassword} disabled={loading || newPassword.length < 6}
              style={{ padding: '13px 0', background: 'var(--c-action)', boxShadow: '0 2px 0 var(--c-action-step)', color: 'white', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit' }}>
              {loading ? '...' : t('_auth_submit_newpassword')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: 16, position: 'relative' }}>
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 3, fontSize: 13, color: 'var(--c-text)', cursor: 'pointer',
        }}
      >
        {t('_auth_back')}
      </button>

      <div onClick={onBack} style={{ cursor: 'pointer', marginBottom: 24 }}>
        <Wordmark />
      </div>

      <div style={{ width: '100%', maxWidth: 380, background: 'var(--c-surface)', borderRadius: 5, padding: 24, boxShadow: '4px 4px 0 var(--c-border-md)' }}>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-muted)', marginBottom: 16 }}>{t('_auth_subtitle')}</p>

        {mode !== 'reset' && (
          <div style={{ display: 'flex', background: 'var(--c-bg)', borderRadius: 3, padding: 3, marginBottom: 16 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setMsg(null); setAgreed(false) }} style={{
                flex: 1, padding: '6px 0', borderRadius: 3, border: 'none',
                background: mode === m ? 'var(--c-surface)' : 'transparent',
                color: mode === m ? 'var(--c-text)' : 'var(--c-muted)',
                fontSize: 13, fontWeight: mode === m ? 500 : 400, cursor: 'pointer',
                boxShadow: mode === m ? '0 2px 0 var(--c-text)' : 'none',
              }}>{m === 'login' ? t('_auth_tab_login') : t('_auth_tab_register')}</button>
            ))}
          </div>
        )}

        {mode === 'reset' && (
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{t('_auth_recovery_title')}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'register' && (
            <>
              <input style={inp} placeholder={t('_auth_name_placeholder')} value={displayName} onChange={e => setDisplayName(e.target.value)} />
              <input style={inp} placeholder={t('_auth_phone_placeholder')} value={phone} type="tel" onChange={e => setPhone(e.target.value)} />
            </>
          )}
          <input style={inp} placeholder={t('_auth_email_placeholder')} value={email} onChange={e => setEmail(e.target.value)} />

          {mode !== 'reset' && (
            <input style={inp} placeholder={t('_auth_password_placeholder')} type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          )}

          {mode === 'login' && (
            <button onClick={() => { setMode('reset'); setMsg(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--c-muted)', fontSize: 12, textAlign: 'right', cursor: 'pointer', padding: 0 }}>
              {t('_auth_forgot')}
            </button>
          )}

          {msg && (
            <div style={{ fontSize: 12, color: msg.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{msg.text}</div>
          )}

          {loading ? <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-muted)', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>...</span> : (
            <button onClick={handleSubmit} disabled={(SITE_KEY_ACTIVE && !captchaReady) || (mode === 'register' && !agreed)}
              style={{ padding: '13px 0', background: canSubmit ? 'var(--c-action)' : 'var(--c-border-md)', color: canSubmit ? 'white' : 'var(--c-faint)', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed', minHeight: 44 }}>
              {mode === 'login' ? t('_auth_submit_login') : mode === 'register' ? t('_auth_submit_register') : t('_auth_submit_reset')}
            </button>
          )}

          <TurnstileWidget
            action={mode === 'register' ? 'register' : mode === 'login' ? 'login' : 'reset'}
            resetKey={captchaEpoch}
            onToken={setCaptchaToken}
            onReady={() => setCaptchaReady(true)}
            onError={() => { setCaptchaReady(false); setCaptchaToken('') }}
          />

          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setMsg(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--c-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              {t('_auth_back_to_login')}
            </button>
          )}

          {mode !== 'reset' && (
            <>
              {/* Explicit consent on registration; Google/login users are covered by the one-time ConsentGate */}
              {mode === 'register' && <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.5, color: 'var(--c-muted)', cursor: 'pointer', margin: '2px 0 0' }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--c-accent)', cursor: 'pointer' }} />
                <span>
                  {t('_auth_consent_prefix')}{' '}
                  <a href={t('_auth_consent_terms_url')} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--c-accent)', textDecoration: 'none' }}>{t('_auth_consent_terms')}</a>{' '}
                  {t('_auth_consent_and')}{' '}
                  <a href={t('_auth_consent_privacy_url')} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--c-accent)', textDecoration: 'none' }}>{t('_auth_consent_privacy')}</a>,{' '}
                  {t('_auth_consent_suffix')}
                </span>
              </label>}

              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--c-muted)' }}>{t('_auth_or')}</div>
              <button onClick={handleGoogle} style={{ cursor: 'pointer', padding: '13px 0', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 3, fontSize: 14, minHeight: 44 }}>
                {t('_auth_google')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}