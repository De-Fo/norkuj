import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/Wordmark'

type Mode = 'login' | 'register'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--c-border)', borderRadius: 8,
  fontSize: 13, color: 'var(--c-text)', background: 'var(--c-surface)',
  outline: 'none', transition: 'border-color 0.15s',
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSubmit = async () => {
    setLoading(true); setMsg(null)
    if (mode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setMsg({ ok: false, text: error.message }); setLoading(false); return }
      if (data?.user) {
        await supabase.from('profiles').insert([{
          id: data.user.id,
          display_name: displayName,
          phone,
          email_verified: false,
        }] as any)
        setMsg({ ok: true, text: 'Zkontroluj email a potvrď registraci.' })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ ok: false, text: 'Špatný email nebo heslo.' })
    }
    setLoading(false)
  }

  const handleGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--c-bg)', padding: 16,
    }}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: 14,
        border: '1px solid var(--c-border)', padding: '32px 28px',
        width: '100%', maxWidth: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Wordmark size="lg" />
          <p style={{ fontSize: 13, color: 'var(--c-muted)', marginTop: 6 }}>
            Pronájem bez realitky
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'var(--c-bg)', borderRadius: 8,
          padding: 3, marginBottom: 20,
        }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
              background: mode === m ? 'var(--c-surface)' : 'transparent',
              color: mode === m ? 'var(--c-text)' : 'var(--c-muted)',
              fontSize: 13, fontWeight: mode === m ? 500 : 400, cursor: 'pointer',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {m === 'login' ? 'Přihlásit se' : 'Registrovat'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'register' && (
            <>
              <input style={inputStyle} placeholder="Jméno" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onFocus={e => (e.target.style.borderColor = 'var(--c-accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
              />
              <input style={inputStyle} placeholder="Telefon (+420 ...)" value={phone}
                onChange={e => setPhone(e.target.value)} type="tel"
                onFocus={e => (e.target.style.borderColor = 'var(--c-accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
              />
            </>
          )}
          <input style={inputStyle} placeholder="Email" value={email} type="email"
            onChange={e => setEmail(e.target.value)}
            onFocus={e => (e.target.style.borderColor = 'var(--c-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
          />
          <input style={inputStyle} placeholder="Heslo" value={password} type="password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={e => (e.target.style.borderColor = 'var(--c-accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
          />
        </div>

        {msg && (
          <div style={{
            marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 12,
            background: msg.ok ? '#dcfce7' : '#fee2e2',
            color: msg.ok ? '#15803d' : '#b91c1c',
          }}>
            {msg.text}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', marginTop: 14, padding: '10px 0',
          background: loading ? 'var(--c-border-md)' : 'var(--c-text)',
          color: 'white', border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}>
          {loading ? '...' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>nebo</span>
          <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
        </div>

        <button onClick={handleGoogle} style={{
          width: '100%', padding: '10px 0', border: '1px solid var(--c-border)',
          borderRadius: 8, background: 'var(--c-surface)', fontSize: 13,
          color: 'var(--c-text)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--c-surface)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Pokračovat přes Google
        </button>
      </div>
    </div>
  )
}