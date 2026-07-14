import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'

type Mode = 'login' | 'register' | 'reset'

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--c-border)',
  borderRadius: 8, fontSize: 13, color: 'var(--c-text)', background: 'var(--c-surface)', outline: 'none',
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)

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
    setLoading(true); setMsg(null)
    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, phone } },
      })
      if (error) { setMsg({ ok: false, text: mapError(error, t) }); setLoading(false); return }
      if (data?.user) {
        await supabase.from('profiles').upsert(
          [{ id: data.user.id, display_name: displayName, phone, email }] as any,
          { onConflict: 'id', ignoreDuplicates: false }
        )
        setMsg({ ok: true, text: t('_auth_register_success') })
      }
    } else if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ ok: false, text: mapError(error, t) })
    } else if (mode === 'reset') {
      const resetRedirect = window.location.origin + '/'
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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

  const handleGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

  if (recoveryMode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)', padding: 16 }}>
        <div onClick={onBack} style={{ cursor: 'pointer', marginBottom: 24 }}>
          <Wordmark />
        </div>
        <div style={{ width: '100%', maxWidth: 380, background: 'var(--c-surface)', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{t('_auth_reset_title')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input style={inp} placeholder={t('_auth_newpassword_placeholder')} type="password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdatePassword()} />
            {msg && <div style={{ fontSize: 12, color: msg.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{msg.text}</div>}
            <button onClick={handleUpdatePassword} disabled={loading || newPassword.length < 6}
              style={{ padding: '11px 0', background: 'var(--c-accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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
          borderRadius: 8, fontSize: 13, color: 'var(--c-text)', cursor: 'pointer',
        }}
      >
        {t('_auth_back')}
      </button>

      <div onClick={onBack} style={{ cursor: 'pointer', marginBottom: 24 }}>
        <Wordmark />
      </div>

      <div style={{ width: '100%', maxWidth: 380, background: 'var(--c-surface)', borderRadius: 12, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-muted)', marginBottom: 16 }}>{t('_auth_subtitle')}</p>

        {mode !== 'reset' && (
          <div style={{ display: 'flex', background: 'var(--c-bg)', borderRadius: 8, padding: 3, marginBottom: 16 }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setMsg(null) }} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                background: mode === m ? 'var(--c-surface)' : 'transparent',
                color: mode === m ? 'var(--c-text)' : 'var(--c-muted)',
                fontSize: 13, fontWeight: mode === m ? 500 : 400, cursor: 'pointer',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
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

          <button onClick={handleSubmit} disabled={loading} style={{ padding: '11px 0', background: 'var(--c-accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? '...' : mode === 'login' ? t('_auth_submit_login') : mode === 'register' ? t('_auth_submit_register') : t('_auth_submit_reset')}
          </button>

          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setMsg(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--c-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
              {t('_auth_back_to_login')}
            </button>
          )}

          {mode !== 'reset' && (
            <>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--c-muted)' }}>{t('_auth_or')}</div>
              <button onClick={handleGoogle} style={{ padding: '11px 0', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                {t('_auth_google')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}