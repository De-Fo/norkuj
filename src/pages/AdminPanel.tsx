import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'

const ADMIN_UIDS = import.meta.env.PANEL_ADMIN_UIDS;

interface AdminListing {
  id: string
  title: string
  description: string
  property_type: string
  price_total_czk: number
  area_sqm: number
  address_street: string
  address_district: string
  address_city: string
  status: string
  created_at: string
  image_paths: string[]
  owner: { display_name: string; phone: string } | null
}

// Map tab key → DB status value
const TAB_STATUS: Record<string, string | null> = {
  pending:   'pending_review',
  published: 'published',
  rejected:  'rejected',
  all:       null,
}

type Tab = 'pending' | 'published' | 'rejected' | 'all'

const STATUS_COLORS: Record<string, string> = {
  pending_review: '#f59e0b',
  published:      '#16a34a',
  rejected:       '#dc2626',
  draft:          '#94a3b8',
  deleted:        '#94a3b8',
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Čeká',
  published:      'Zveřejněn',
  rejected:       'Zamítnut',
  draft:          'Koncept',
  deleted:        'Smazán',
}

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [listings, setListings] = useState<AdminListing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [selected, setSelected] = useState<AdminListing | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [acting, setActing] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [stats, setStats] = useState({ pending: 0, published: 0, rejected: 0, total: 0 })
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user ? ADMIN_UIDS.includes(data.user.id) : false)
    })
  }, [])

  const fetchListings = async () => {
    setLoading(true)

    // Fetch all for stats
    const { data: allData } = await supabase
      .from('listings')
      .select('status')

    if (allData) {
      setStats({
        pending:   allData.filter(l => l.status === 'pending_review').length,
        published: allData.filter(l => l.status === 'published').length,
        rejected:  allData.filter(l => l.status === 'rejected').length,
        total:     allData.length,
      })
    }

    // Fetch listings for current tab
    const statusFilter = TAB_STATUS[tab]
    let query = supabase
      .from('listings')
      .select('id,title,description,property_type,price_total_czk,area_sqm,address_street,address_district,address_city,status,created_at,image_paths,owner:profiles(display_name,phone)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Admin fetch error:', error)
      setListings([])
    } else {
      setListings((data ?? []) as AdminListing[])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) fetchListings()
  }, [tab, isAdmin])

  const showMsg = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  const approve = async (id: string) => {
    setActing(true)
    const { error } = await supabase
      .from('listings')
      .update({ status: 'published' })
      .eq('id', id)

    if (error) {
      console.error('Approve error:', error)
      showMsg(`Chyba: ${error.message}`)
    } else {
      showMsg('✅ Inzerát zveřejněn')
      setSelected(null)
      await fetchListings()
    }
    setActing(false)
  }

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { showMsg('Zadej důvod zamítnutí'); return }
    setActing(true)
    const { error } = await supabase
      .from('listings')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) {
      showMsg(`Chyba: ${error.message}`)
    } else {
      showMsg('❌ Inzerát zamítnut')
      setSelected(null)
      setRejectReason('')
      await fetchListings()
    }
    setActing(false)
  }

  const deleteL = async (id: string) => {
    if (!confirm('Opravdu smazat?')) return
    setActing(true)
    const { error } = await supabase
      .from('listings')
      .update({ status: 'deleted' })
      .eq('id', id)

    if (error) {
      showMsg(`Chyba: ${error.message}`)
    } else {
      showMsg('🗑 Smazáno')
      setSelected(null)
      await fetchListings()
    }
    setActing(false)
  }

  if (isAdmin === false) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ fontSize: 15, marginBottom: 16 }}>Nemáš přístup do admin panelu.</p>
        <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Zavřít</button>
      </div>
    </div>
  )

  if (isAdmin === null) return null

  const TABS: { key: Tab; label: string; count: number; color: string }[] = [
    { key: 'pending',   label: 'Čeká na schválení', count: stats.pending,   color: '#f59e0b' },
    { key: 'published', label: 'Zveřejněné',         count: stats.published, color: '#16a34a' },
    { key: 'rejected',  label: 'Zamítnuté',           count: stats.rejected,  color: '#dc2626' },
    { key: 'all',       label: 'Všechny',             count: stats.total,     color: '#64748b' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
      <div style={{ width: '92%', maxWidth: 1100, height: '90vh', background: '#f4f6f8', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#7c3aed' }}>🛠 Admin panel</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: tab === t.key ? t.color : '#f1f5f9',
                  color: tab === t.key ? 'white' : '#64748b',
                  fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {actionMsg && (
              <span style={{ fontSize: 12, color: '#15803d', background: '#dcfce7', padding: '4px 10px', borderRadius: 6 }}>
                {actionMsg}
              </span>
            )}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#f1f5f9', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* List */}
          <div style={{ width: 340, borderRight: '1px solid #e2e8f0', overflow: 'auto', flexShrink: 0, background: 'white' }}>
            {loading && (
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}

            {!loading && listings.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Žádné inzeráty v této kategorii
              </div>
            )}

            {!loading && listings.map(l => (
              <div key={l.id} onClick={() => { setSelected(l); setRejectReason('') }} style={{
                padding: '12px 14px',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                background: selected?.id === l.id ? '#faf5ff' : 'white',
                borderLeft: `3px solid ${selected?.id === l.id ? '#7c3aed' : 'transparent'}`,
                transition: 'all 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {l.title}
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: STATUS_COLORS[l.status] + '22', color: STATUS_COLORS[l.status], fontWeight: 600, flexShrink: 0 }}>
                    {STATUS_LABELS[l.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                  {PROPERTY_TYPE_LABELS[l.property_type as any]} · {l.area_sqm} m² · {formatPrice(l.price_total_czk)}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {l.address_district} · {formatDate(l.created_at)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  👤 {l.owner?.display_name ?? '—'} · {l.owner?.phone || 'bez tel.'}
                </div>
              </div>
            ))}
          </div>

          {/* Detail */}
          {selected ? (
            <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {selected.image_paths.length > 0 && (
                <div style={{ height: 200, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={getImageUrl(selected.image_paths[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}

              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.title}</h2>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  {selected.address_street}, {selected.address_district} · {formatPrice(selected.price_total_czk)} · {selected.area_sqm} m²
                </p>
              </div>

              <div style={{ padding: '12px 14px', background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.7, maxHeight: 160, overflow: 'auto', color: '#0f172a' }}>
                {selected.description}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                {[
                  ['Majitel',   selected.owner?.display_name ?? '—'],
                  ['Telefon',   selected.owner?.phone || '—'],
                  ['Dispozice', PROPERTY_TYPE_LABELS[selected.property_type as any]],
                  ['Plocha',    `${selected.area_sqm} m²`],
                  ['Cena',      formatPrice(selected.price_total_czk)],
                  ['Status',    STATUS_LABELS[selected.status]],
                  ['Přidáno',   formatDate(selected.created_at)],
                  ['ID',        selected.id.slice(0, 8) + '...'],
                  ['Fotky',     `${selected.image_paths.length} ks`],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '8px 10px', background: 'white', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ color: '#94a3b8', marginBottom: 2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                    <div style={{ fontWeight: 500, color: '#0f172a' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

                {(selected.status === 'pending_review' || selected.status === 'rejected') && (
                  <button
                    onClick={() => approve(selected.id)}
                    disabled={acting}
                    style={{ padding: '11px 0', background: acting ? '#86efac' : '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: acting ? 'not-allowed' : 'pointer' }}
                  >
                    {acting ? 'Zpracovávám...' : '✅ Schválit a zveřejnit'}
                  </button>
                )}

                {selected.status !== 'rejected' && selected.status !== 'deleted' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder="Důvod zamítnutí (povinné)..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      style={{ flex: 1, padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' }}
                    />
                    <button
                      onClick={() => reject(selected.id)}
                      disabled={acting || !rejectReason.trim()}
                      style={{ padding: '9px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: acting ? 'not-allowed' : 'pointer', opacity: !rejectReason.trim() ? 0.5 : 1 }}
                    >
                      Zamítnout
                    </button>
                  </div>
                )}

                {selected.status === 'published' && (
                  <button
                    onClick={() => reject(selected.id)}
                    disabled={acting}
                    style={{ padding: '9px 0', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    ⏸ Stáhnout z nabídky
                  </button>
                )}

                <button
                  onClick={() => deleteL(selected.id)}
                  disabled={acting}
                  style={{ padding: '9px 0', background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                >
                  🗑 Trvale smazat
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 32 }}>👈</span>
              Vyber inzerát ze seznamu
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}