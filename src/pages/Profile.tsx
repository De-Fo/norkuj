import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useLang } from '../lib/lang'

interface Props {
  user: User | null
  onBack: () => void
}

export function ProfilePage({ user, onBack }: Props) {
  const { t } = useLang()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: t('_profile_saved') })
  }

  const handleDeleteProfile = async () => {
    if (!user) return
    setDeleting(true)
    try {
      const { error } = await supabase.functions.invoke('delete-profile', {
        method: 'POST',
      })
      if (error) throw new Error(error.message)
      await supabase.auth.signOut()
      onBack()
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? t('_profile_delete_fail') })
      setShowDeleteConfirm(false)
    }
    setDeleting(false)
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24 }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '8px 14px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--c-text)' }}>
        {t('_profile_back')}
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--c-text)' }}>{t('_profile_title')}</h2>

      {loading ? <p style={{ color: 'var(--c-muted)' }}>{t('_profile_load')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('_profile_email')}</label>
          <input value={profile?.email ?? user.email ?? ''} disabled
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-bg)', color: 'var(--c-muted)' }} />

          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('_profile_name')}</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' }} />

          <label style={{ fontSize: 12, color: 'var(--c-muted)' }}>{t('_profile_phone')}</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
            style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' }} />

          {msg && <div style={{ fontSize: 12, color: msg.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{msg.text}</div>}

          <button onClick={handleSave} disabled={saving}
            style={{ padding: '11px 0', background: 'var(--c-accent)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? t('_profile_saving') : t('_profile_save')}
          </button>

          {/* Delete profile button */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--c-border)' }}>
            {showDeleteConfirm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--c-muted)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--c-red)' }}>{t('_profile_delete_warning')}</strong> {t('_profile_delete_text')}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                    style={{ flex: 1, padding: '11px 0', border: '1px solid var(--c-border)', borderRadius: 8,
                      background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' }}>
                    {t('_profile_delete_cancel')}
                  </button>
                  <button onClick={handleDeleteProfile} disabled={deleting}
                    style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 8,
                      background: 'var(--c-red)', color: 'white', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                    {deleting ? t('_profile_delete_progress') : t('_profile_delete_confirm')}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ width: '100%', padding: '11px 0', border: '1px solid color-mix(in srgb, var(--c-red) 40%, transparent)', borderRadius: 8,
                  background: 'transparent', color: 'var(--c-red)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                🗑 {t('_profile_delete_title')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
