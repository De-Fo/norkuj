import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'

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
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  // Escape key for password modal
  useEffect(() => {
    if (!pwOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPwOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pwOpen])

  const isOAuthOnly = user && user.app_metadata?.providers
    ? (user.app_metadata.providers as string[]).length === 1 && (user.app_metadata.providers as string[])[0] !== 'email'
    : false

  const handleChangePassword = async () => {
    setPwMsg(null)
    // Client validation
    if (pwNew !== pwConfirm) { setPwMsg(t('_profile_password_mismatch')); return }
    if (pwNew.length < 6) { setPwMsg(t('_error_auth_weak_password')); return }
    setPwSaving(true)
    // Verify current password by attempting a fresh sign-in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: pwCurrent,
    })
    if (verifyErr) { setPwMsg(mapError(verifyErr, t, 'password_change')); setPwSaving(false); return }
    // Current password is correct — update
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew })
    if (updateErr) { setPwMsg(mapError(updateErr, t)); setPwSaving(false); return }
    setPwMsg(t('_profile_password_changed'))
    setPwSaving(false)
    setTimeout(() => { setPwOpen(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwMsg(null) }, 1200)
  }

  useEffect(() => {
    if (!user) return
    (supabase.from('profiles') as any).select('*').eq('id', user.id).maybeSingle().then(({ data, error }: any) => {
      if (error && import.meta.env.DEV) console.error('[profile load]', error)
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
    setMsg(error ? { ok: false, text: mapError(error, t) } : { ok: true, text: t('_profile_saved') })
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
    } catch (e: unknown) {
      setMsg({ ok: false, text: mapError(e, t) })
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

          {/* Change password */}
          {!isOAuthOnly && (
            <>
              <button onClick={() => setPwOpen(true)}
                style={{ width: '100%', padding: '11px 0', border: '1px solid var(--c-border)', borderRadius: 8,
                  background: 'var(--c-surface)', color: 'var(--c-text)', fontSize: 13, cursor: 'pointer' }}>
                {t('_profile_password_section')}
              </button>

              {/* ═══ Password modal ═══ */}
              {pwOpen && (
                <div onClick={e => { if (e.target === e.currentTarget) setPwOpen(false) }}
                  style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 80, padding: 16,
                  }}>
                  <div style={{
                    background: 'var(--c-surface)', borderRadius: 16,
                    maxWidth: 400, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
                    position: 'relative',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderBottom: '1px solid var(--c-border)',
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>
                        {t('_profile_password_section')}
                      </span>
                      <button onClick={() => setPwOpen(false)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: 'none',
                          background: 'var(--c-bg)', cursor: 'pointer',
                          fontSize: 14, color: 'var(--c-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input type="password" placeholder={t('_profile_password_current')} value={pwCurrent}
                        onChange={e => setPwCurrent(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                        style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
                          background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none' }} />
                      <input type="password" placeholder={t('_profile_password_new')} value={pwNew}
                        onChange={e => setPwNew(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                        style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
                          background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none' }} />
                      <input type="password" placeholder={t('_profile_password_confirm')} value={pwConfirm}
                        onChange={e => setPwConfirm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                        style={{ padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
                          background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none' }} />
                      {pwMsg && (
                        <div style={{ fontSize: 12, color: pwMsg === t('_profile_password_changed') ? 'var(--c-green)' : 'var(--c-red)' }}>
                          {pwMsg}
                        </div>
                      )}
                      <button onClick={handleChangePassword} disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
                        style={{ padding: '11px 0', background: pwSaving ? 'color-mix(in srgb, var(--c-accent) 60%, transparent)' : 'var(--c-accent)',
                          color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          opacity: !pwCurrent || !pwNew || !pwConfirm ? 0.5 : 1 }}>
                        {pwSaving ? '...' : t('_profile_password_submit')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {isOAuthOnly && (
            <p style={{ fontSize: 12, color: 'var(--c-muted)', fontStyle: 'italic' }}>
              {t('_profile_password_google_note')}
            </p>
          )}

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
