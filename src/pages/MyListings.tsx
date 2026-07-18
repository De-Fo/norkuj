import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Listing, ListingStatus } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'
import { useLang } from '../lib/lang'
import { mapError } from '../lib/errors'

interface Props {
  user: User | null
  onBack: () => void
  onEdit: (listing: Listing) => void
}

const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: '_mylistings_status_draft',
  pending_review: '_mylistings_status_pending',
  published: '_mylistings_status_published',
  rented: '_mylistings_status_rented',
  rejected: '_mylistings_status_rejected',
  deleted: '_mylistings_status_deleted',
}

const STATUS_COLORS: Record<ListingStatus, string> = {
  draft: '#94a3b8',
  pending_review: '#d97706',
  published: '#16a34a',
  rented: '#2563eb',
  rejected: '#dc2626',
  deleted: '#64748b',
}

export function MyListingsPage({ user, onBack, onEdit }: Props) {
  const { t } = useLang()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

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
    const { error } = await (supabase.from('listings') as any).update({ status: 'deleted' }).eq('id', id)
    if (error) { alert(mapError(error, t)); setBusyId(null); return }
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
      <button onClick={onBack} style={{ marginBottom: 16, padding: '10px 16px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, minHeight: 40 }}>
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
            borderRadius: 10, background: 'var(--c-surface)', alignItems: 'center',
          }}>
            <img
              src={l.image_paths?.[0] ? getImageUrl(l.image_paths[0]) : undefined}
              onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
              style={{ width: 72, height: 60, objectFit: 'cover', borderRadius: 8, background: 'var(--c-bg)', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</p>
              <p style={{ fontSize: 12, color: 'var(--c-muted)' }}>
                {PROPERTY_TYPE_LABELS[l.property_type]} · {formatPrice(l.price_total_czk)} · {t('_mylistings_added')} {formatDate(l.created_at)}
              </p>
              <span style={{
                display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600,
                color: 'white', background: STATUS_COLORS[l.status], padding: '2px 8px', borderRadius: 6,
              }}>
                {t(STATUS_LABELS[l.status])}
              </span>
              {l.status === 'rejected' && (l as any).rejection_reason && (
                <p style={{ fontSize: 11, color: 'var(--c-red)', marginTop: 4 }}>
                  {t('_mylistings_rejection_reason')} {(l as any).rejection_reason}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              {(l.status === 'draft' || l.status === 'published' || l.status === 'rejected') && (
                <button onClick={() => onEdit(l)} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--c-border)', borderRadius: 7, background: 'var(--c-surface)', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_edit')}
                </button>
              )}
              {l.status === 'published' && (
                <button onClick={() => handleMarkRented(l.id)} disabled={busyId === l.id} style={{ padding: '8px 14px', fontSize: 12, border: 'none', borderRadius: 7, background: 'var(--c-accent)', color: 'white', cursor: 'pointer', minHeight: 34 }}>
                  {t('_mylistings_mark_rented')}
                </button>
              )}
              <button onClick={() => handleDelete(l.id)} disabled={busyId === l.id} style={{ padding: '8px 14px', fontSize: 12, border: 'none', borderRadius: 7, background: 'color-mix(in srgb, var(--c-red) 15%, transparent)', color: 'var(--c-red)', cursor: 'pointer', minHeight: 34 }}>
                {t('_mylistings_delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}