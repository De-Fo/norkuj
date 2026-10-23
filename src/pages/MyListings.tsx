import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Listing, ListingStatus } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'
import { ContractModal } from '../components/ContractModal'

interface Props {
  user: User | null
  onBack: () => void
  onEdit: (listing: Listing) => void
  onRelist?: (listing: Listing) => void   // relist a rented/closed listing (open the prefilled form)
}

const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: '_mylistings_status_draft',
  pending_review: '_mylistings_status_pending',
  published: '_mylistings_status_published',
  rented: '_mylistings_status_rented',
  rejected: '_mylistings_status_rejected',
  deleted: '_mylistings_status_deleted',
  expired: '_mylistings_status_expired',
}

const STATUS_COLORS: Record<ListingStatus, string> = {
  draft: '#94a3b8',
  pending_review: '#d97706',
  published: '#16a34a',
  rented: '#13408a',
  rejected: '#b91c1c',
  deleted: '#64748b',
  expired: '#8a5a00',
}

export function MyListingsPage({ user, onBack, onEdit, onRelist }: Props) {
  const { t } = useLang()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [contractFor, setContractFor] = useState<Listing | null>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('owner_id', user.id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    setListings((data as Listing[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const handleDelete = async (id: string) => {
    if (!confirm(t('_mylistings_confirm_delete'))) return
    setBusyId(id)
    // Manual delete is final: remove the photos from the public bucket too (right to erasure).
    // Paths are read from the DB and limited to the caller's own folder (storage RLS enforces it as well).
    const { data: row } = await (supabase.from('listings') as any).select('image_paths').eq('id', id).eq('owner_id', user!.id).maybeSingle()
    const mine = ((row?.image_paths ?? []) as string[]).filter(p => p.startsWith(user!.id + '/'))
    // A relisted listing reuses the original's photo paths. Keep any file another of my live listings still points at.
    let own = mine
    if (mine.length > 0) {
      const { data: others } = await (supabase.from('listings') as any)
        .select('image_paths').eq('owner_id', user!.id).neq('id', id).neq('status', 'deleted')
      const inUse = new Set<string>(((others ?? []) as { image_paths: string[] | null }[]).flatMap(o => o.image_paths ?? []))
      own = mine.filter(p => !inUse.has(p))
    }
    const { error } = await (supabase.from('listings') as any).update({ status: 'deleted', image_paths: [] }).eq('id', id)
    if (error) { alert(mapError(error, t)); setBusyId(null); return }
    if (own.length > 0) supabase.storage.from('listing-images').remove(own).catch((e: unknown) => {
      if (import.meta.env.DEV) console.error('[storage cleanup]', e)
    })
    // Fire-and-forget: notify owner
    supabase.functions.invoke('send-listing-email', {
      method: 'POST',
      body: { listingId: id, eventType: 'deleted' },
    }).catch((e: unknown) => {
      if (import.meta.env.DEV) console.error('[email notify]', e)
    })
    setBusyId(null)
    load()
  }

  // Renewal goes through a database function (owner check + status rules), because plain users cannot write expires_at.
  const handleRenew = async (id: string) => {
    setBusyId(id)
    const { error } = await (supabase.rpc as any)('renew_listing', { p_listing_id: id })
    if (error) { alert(mapError(error, t)); setBusyId(null); return }
    setBusyId(null)
    load()
  }

  const daysLeft = (l: Listing) => l.expires_at ? Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86_400_000) : null
  const canRenew = (l: Listing) => {
    if (l.status === 'expired') return true
    const d = l.status === 'published' ? daysLeft(l) : null
    return d !== null && d <= 7
  }

  const handleMarkRented = async (id: string) => {
    setBusyId(id)
    const { error } = await (supabase.from('listings') as any).update({ status: 'rented' }).eq('id', id)
    if (error) { alert(mapError(error, t)); setBusyId(null); return }
    setBusyId(null)
    load()
  }

  if (!user) return null

  return (
    <div style={{ maxWidth: 720, margin: window.innerWidth < 768 ? '16px auto' : '32px auto', padding: 16 }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: '10px 16px', border: '1px solid var(--c-border)', borderRadius: 3, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, minHeight: 40 }}>
        {t('_mylistings_back')}
      </button>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{t('_mylistings_title')}</h2>

      {loading && <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>{t('loading')}</p>}

      {!loading && listings.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--c-muted)' }}>{t('_mylistings_empty')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {listings.map(l => (
          <div key={l.id} style={{
            display: 'flex', gap: 12, padding: 12, border: '1px solid var(--c-border)',
            borderRadius: 4, background: 'var(--c-surface)', alignItems: 'center',
          }}>
            <img
              src={l.image_paths?.[0] ? getImageUrl(l.image_paths[0]) : undefined}
              onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              style={{ width: 72, height: 60, objectFit: 'cover', borderRadius: 3, background: 'var(--c-bg)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
              <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                {PROPERTY_TYPE_LABELS[l.property_type]} · {formatPrice(l.price_total_czk)} · {t('_mylistings_added')} {formatDate(l.created_at)}
              </p>
              <span style={{
                display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600,
                color: 'white', background: STATUS_COLORS[l.status], padding: '2px 8px', borderRadius: 3,
              }}>
                {t(STATUS_LABELS[l.status])}
              </span>
              {l.status === 'published' && daysLeft(l) !== null && (
                <p style={{ fontSize: 11, color: (daysLeft(l) as number) <= 7 ? 'var(--c-red-ink)' : 'var(--c-muted)', marginTop: 4, fontWeight: (daysLeft(l) as number) <= 7 ? 600 : 400 }}>
                  {(daysLeft(l) as number) > 0 ? `${t('_mylistings_expires_in')} ${daysLeft(l)} ${t('_mylistings_days')}` : t('_mylistings_expires_today')}
                </p>
              )}
              {l.status === 'expired' && (
                <p style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 4 }}>{t('_mylistings_expired_hint')}</p>
              )}
              {l.status === 'rejected' && (l as any).rejection_reason && (
                <p style={{ fontSize: 11, color: 'var(--c-red)', marginTop: 4 }}>
                  {t('_mylistings_rejection_reason')} {(l as any).rejection_reason}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              {(l.status === 'draft' || l.status === 'published' || l.status === 'rejected' || l.status === 'expired') && (
                <button onClick={() => onEdit(l)} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 3, background: 'var(--c-surface)', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_edit')}
                </button>
              )}
              {canRenew(l) && (
                <button className="btn-action" onClick={() => handleRenew(l.id)} disabled={busyId === l.id}
                  style={{ padding: '8px 14px', fontSize: 12, minHeight: 36 }}>
                  {t('_mylistings_renew')}
                </button>
              )}
              {l.status === 'published' && (
                <button onClick={() => handleMarkRented(l.id)} disabled={busyId === l.id} style={{ padding: '8px 14px', fontSize: 12, border: 'none', borderRadius: 3, background: 'var(--c-action)', boxShadow: '0 2px 0 var(--c-action-step)', color: 'white', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_mark_rented')}
                </button>
              )}
              {l.status === 'rented' && onRelist && (
                <button onClick={() => onRelist(l)} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 3, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_relist')}
                </button>
              )}
              {(l.status === 'draft' || l.status === 'published' || l.status === 'rejected' || l.status === 'rented') && (
                <button onClick={() => setContractFor(l)} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 3, background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_contract')}
                </button>
              )}
              <button onClick={() => handleDelete(l.id)} disabled={busyId === l.id} style={{ padding: '8px 14px', fontSize: 12, border: 'none', borderRadius: 3, background: 'color-mix(in srgb, var(--c-red) 15%, transparent)', color: 'var(--c-red)', cursor: 'pointer', minHeight: 34 }}>
                {t('_mylistings_delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {contractFor && <ContractModal listing={contractFor} onClose={() => setContractFor(null)} />}
    </div>
  )
}