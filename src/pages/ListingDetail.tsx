import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useLang } from '../lib/lang'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY

// ── Mini map showing the listing's location ──
function MiniMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const { t } = useLang()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const map = new maplibregl.Map({
      container: ref.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [lng, lat],
      zoom: 14,
      interactive: false,
    })
    map.on('load', () => {
      new maplibregl.Marker({ color: '#2563eb' }).setLngLat([lng, lat]).addTo(map)
    })
    return () => map.remove()
  }, [lat, lng])

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{t('_detail_location')}</h3>
      <div ref={ref} style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }} />
    </div>
  )
}

interface OwnerInfo {
  display_name: string
  phone: string
  email: string
  avatar_url: string | null
}

interface FullListing extends Listing {
  owner?: OwnerInfo | null
}

interface Props {
  listingId: string
  onClose: () => void
  onRequestAuth?: () => void
  user?: any | null
  isFavorited?: boolean
  onToggleFavorite?: (id: string) => void
}

export function ListingDetail({ listingId, onClose, onRequestAuth, user: propUser, isFavorited, onToggleFavorite }: Props) {
  const { t } = useLang()
  const [listing, setListing] = useState<FullListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [showContact, setShowContact] = useState(false)
  const user = propUser

  useEffect(() => {
    if (!listingId) return
    setLoading(true)
    setErrorMsg(null)
    setActiveImg(0)
    setShowContact(false)

    const doFetch = async () => {
      // First try: fetch as published (public)
      let { data, error } = await supabase
        .from('listings')
        .select('*, owner:profiles(display_name, phone, email, avatar_url)')
        .eq('id', listingId)
        .maybeSingle()

      if (error) {
        console.error('[ListingDetail] fetch error:', error)
        setErrorMsg(`Chyba: ${error.message}`)
        setLoading(false)
        return
      }

      if (!data) {
        console.warn('[ListingDetail] no data returned for id:', listingId)
        setErrorMsg('Inzerát nebyl nalezen nebo není zveřejněn.')
        setLoading(false)
        return
      }

      console.log('[ListingDetail] fetched:', data.title, 'status:', data.status)
      setListing(data as FullListing)
      setLoading(false)
    }

    doFetch()
  }, [listingId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const amenities = listing ? [
    listing.furnished    && t('amenities_furnished'),
    listing.pets_allowed && t('amenities_pets'),
    listing.parking      && t('amenities_parking'),
    listing.balcony      && t('amenities_balcony'),
    listing.cellar       && t('amenities_cellar'),
  ].filter(Boolean) : []

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: window.innerWidth < 768 ? 0 : 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 'min(80%, 900px)',
        height: '85vh', maxHeight: window.innerWidth < 768 ? '100dvh' : '85vh',
        background: 'white', borderRadius: window.innerWidth < 768 ? 0 : 16,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: window.innerWidth < 768 ? 'none' : '0 24px 64px rgba(0,0,0,0.35)',
        position: 'relative',
      }}>

        {/* Favorite star */}
        {onToggleFavorite && propUser && (
          <button onClick={() => onToggleFavorite(listingId)}
            style={{
              position: 'absolute', top: 12, right: 52, zIndex: 10,
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.45)', color: isFavorited ? '#fbbf24' : 'white',
              fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isFavorited ? '★' : '☆'}
          </button>
        )}

        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

        {loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #2563eb', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('_detail_loading')}</span>
          </div>
        )}

        {errorMsg && !loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
            <span style={{ fontSize: 40 }}>😕</span>
            <p style={{ color: '#64748b', fontSize: 14, textAlign: 'center', maxWidth: 280 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ padding: '8px 20px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--c-text)' }}>{t('_detail_close')}</button>
          </div>
        )}

        {listing && !loading && !errorMsg && (
          <div style={{ flex: 1, overflow: 'auto' }}>

            {/* Gallery */}
            <div style={{ position: 'relative', height: 300, background: '#0f172a', flexShrink: 0, overflow: 'hidden' }}>
              {listing.image_paths && listing.image_paths.length > 0 ? (
                <>
                  <img
                    src={getImageUrl(listing.image_paths[activeImg])}
                    alt={listing.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>
                    {activeImg + 1} / {listing.image_paths.length}
                  </div>
                  {listing.image_paths.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => (i - 1 + listing.image_paths.length) % listing.image_paths.length)}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 20, cursor: 'pointer' }}>‹</button>
                      <button onClick={() => setActiveImg(i => (i + 1) % listing.image_paths.length)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 20, cursor: 'pointer' }}>›</button>
                      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
                        {listing.image_paths.map((_, i) => (
                          <button key={i} onClick={() => setActiveImg(i)} style={{ width: i === activeImg ? 20 : 7, height: 7, borderRadius: 4, border: 'none', background: i === activeImg ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 48 }}>🏠</div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: window.innerWidth < 768 ? '16px' : '24px 28px', display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', gap: 28 }}>

              {/* Left */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, margin: 0 }}>{listing.title}</h1>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{formatPrice(listing.price_total_czk)}</div>
                    {listing.utilities_czk > 0 && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        nájem {formatPrice(listing.price_czk)} + zálohy {listing.utilities_czk.toLocaleString('cs-CZ')} Kč
                      </div>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>
                  📍 {listing.address_street}{listing.address_district ? `, ${listing.address_district}` : ''}, Praha
                </p>

                {/* Stats */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                  {([
                    [t('_detail_floorplan'), PROPERTY_TYPE_LABELS[listing.property_type]],
                    [t('_detail_area'), `${listing.area_sqm} m²`],
                    listing.floor != null ? [t('_detail_floor'), `${listing.floor}${t('_detail_floor_prefix')}`] : null,
                    [t('_detail_available'), formatDate(listing.available_from)],
                    [t('_detail_min_lease'), `${listing.min_lease_months} ${t('_detail_month')}`],
                    listing.deposit_czk ? [t('_detail_deposit'), `${listing.deposit_czk.toLocaleString('cs-CZ')} Kč`] : null,
                  ] as ([string,string]|null)[])
                    .filter((x): x is [string,string] => x !== null)
                    .map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{v}</div>
                      </div>
                    ))}
                </div>

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {(amenities as string[]).map(a => (
                      <span key={a} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, fontSize: 12, color: '#0f172a' }}>{a}</span>
                    ))}
                  </div>
                )}

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{t('_detail_description')}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#0f172a', margin: 0 }}>{listing.description}</p>
                </div>

                {/* Mini map — extract from PostGIS WKB hex, GeoJSON, or WKT */}
                {(() => {
                  const loc = (listing as any).location
                  let _lat: number | null = null
                  let _lng: number | null = null
                  if (loc) {
                    // WKB hex: "0101000020E6100000<8bytesX><8bytesY>"
                    if (typeof loc === 'string' && /^01010000[02]0E6100/i.test(loc) && loc.length >= 50) {
                      const hexX = loc.slice(18, 34), hexY = loc.slice(34, 50)
                      const bytes = new Uint8Array(
                        (hexX + hexY).match(/.{2}/g)!.map(b => parseInt(b, 16))
                      )
                      _lng = new DataView(bytes.buffer).getFloat64(0, true)
                      _lat = new DataView(bytes.buffer).getFloat64(8, true)
                    }
                    // GeoJSON: {type:"Point",coordinates:[lng,lat]}
                    if (_lat == null && loc.coordinates && Array.isArray(loc.coordinates)) {
                      _lng = loc.coordinates[0]; _lat = loc.coordinates[1]
                    }
                    // WKT string fallback: "POINT(lng lat)"
                    if (_lat == null && typeof loc === 'string') {
                      const m = loc.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/)
                      if (m) { _lng = parseFloat(m[1]); _lat = parseFloat(m[2]) }
                    }
                  }
                  return _lat != null && _lng != null ? (
                    <MiniMap lat={_lat} lng={_lng} title={listing.title} />
                  ) : null
                })()}

                {/* Thumbnail strip */}
                {listing.image_paths && listing.image_paths.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {listing.image_paths.map((path, i) => (
                      <img key={i} src={getImageUrl(path)} alt=""
                        onClick={() => setActiveImg(i)}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        style={{ width: 56, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: i === activeImg ? '2px solid #2563eb' : '1px solid #e2e8f0', opacity: i === activeImg ? 1 : 0.65, transition: 'all 0.15s' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right — contact */}
              <div style={{ width: window.innerWidth < 768 ? '100%' : 220, flexShrink: 0 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, position: 'sticky', top: 0 }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {listing.owner?.avatar_url
                        ? <img src={listing.owner.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <span style={{ fontSize: 20 }}>👤</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{listing.owner?.display_name ?? t('_detail_owner')}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>{t('_detail_private')}</div>
                    </div>
                  </div>

                  {user ? (
                    showContact ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {listing.owner?.phone ? (
                          <a href={`tel:${listing.owner.phone}`} style={{ fontWeight: 600 }}>{listing.owner.phone}</a>
                        ) : (
                          <span style={{ color: 'var(--c-muted)', fontSize: 13 }}>{t('_detail_no_phone')}</span>
                        )}
                        {listing.owner?.email && (
                          <a href={`mailto:${listing.owner.email}`} style={{ fontSize: 13, color: '#2563eb', wordBreak: 'break-all' }}>{listing.owner.email}</a>
                        )}
                        <p style={{ fontSize: 11, color: 'var(--c-muted)' }}>{t('_detail_contact_note')}</p>
                      </div>
                    ) : (
                      <button onClick={() => setShowContact(true)} style={{ width: '100%', padding: '11px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {t('_detail_contact_btn')}
                      </button>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 12, color: 'var(--c-muted)', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                        {t('_detail_login_prompt')}
                      </p>
                      <button
                        onClick={() => { onClose(); onRequestAuth?.() }}
                        style={{ width: '100%', padding: '10px 0', background: 'var(--c-text)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      >
                        {t('_detail_login_btn')}
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                    {t('_detail_added')} {formatDate(listing.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}