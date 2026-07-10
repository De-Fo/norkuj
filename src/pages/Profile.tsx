import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface Props {
  user: User | null
  onBack: () => void
}

export function ProfilePage({ user, onBack }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!user) return
    (supabase.from('profiles') as any).select('*').eq('id', user.id).maybeSingle().then(({ data }: any) => {
      if (data) {
        setProfile(data as Profile)
        setDisplayName(data.display_name ?? '')
        setPhone(data.phone ?? '')
      }
      setLoading(false)
    })
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true); setMsg(null)
    const { error } = await (supabase.from('profiles') as any)
      .update({ display_name: displayName, phone })
      .eq('id', user.id)
    setSaving(false)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Uloženo.' })
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '8px 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13 }}>
        ← Zpět
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Nastavení profilu</h2>

      {loading ? <p>Načítám...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>Email</label>
          <input value={profile?.email ?? user.email ?? ''} disabled
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-muted)' }} />

          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>Jméno</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8 }} />

          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>Telefon</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8 }} />

          {msg && <div style={{ fontSize: 12, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</div>}

          <button onClick={handleSave} disabled={saving}
            style={{ padding: '11px 0', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      )}
    </div>
  )
}