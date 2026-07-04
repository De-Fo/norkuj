import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing, Profile } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'

interface Props {
  listingId: string
  onClose: () => void
}

interface FullListing extends Listing {
  owner?: Pick<Profile, 'display_name' | 'phone' | 'avatar_url'>
}

export function ListingDetail({ listingId, onClose }: Props) {
  const [listing, setListing] = useState<FullListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [showPhone, setShowPhone] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    const fetchListing = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('listings')
        .select('*, owner:profiles(display_name, phone, avatar_url)')
        .eq('id', listingId)
        .single()
      if (error) setError('Inzerát se nepodařilo načíst.')
      else setListing(data as FullListing)
      setLoading(false)
    }
    fetchListing()
  }, [listingId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const amenities = listing ? [
    listing.furnished && '🛋 Zařízený',
    listing.pets_allowed && '🐾 Zvířata OK',
    listing.parking && '🅿 Parkování',
    listing.balcony && '🌿 Balkon',
    listing.cellar && '📦 Sklep',
  ].filter(Boolean) : []

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '80%', maxWidth: 900, height: '85vh', background: 'var(--c-surface)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', position: 'relative' }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>✕</button>

        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #2563eb', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 32 }}>😕</span>
            <p style={{ color: 'var(--c-muted)', fontSize: 14 }}>{error}</p>
            <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Zavřít</button>
          </div>
        )}

        {listing && !loading && (
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Photo gallery */}
            <div style={{ position: 'relative', height: 320, background: '#0f172a', flexShrink: 0, overflow: 'hidden' }}>
              {listing.image_paths.length > 0 ? (
                <>
                  <img
                    src={getImageUrl(listing.image_paths[activeImg])}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }}
                  />
                  {/* Thumbnails */}
                  {listing.image_paths.length > 1 && (
                    <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                      {listing.image_paths.map((_, i) => (
                        <button key={i} onClick={() => setActiveImg(i)} style={{
                          width: i === activeImg ? 24 : 8, height: 8, borderRadius: 4,
                          border: 'none', background: i === activeImg ? 'white' : 'rgba(255,255,255,0.5)',
                          cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                        }} />
                      ))}
                    </div>
                  )}
                  {/* Arrow nav */}
                  {listing.image_paths.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => (i - 1 + listing.image_paths.length) % listing.image_paths.length)}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 16, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                        ‹
                      </button>
                      <button onClick={() => setActiveImg(i => (i + 1) % listing.image_paths.length)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 16, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                        ›
                      </button>
                    </>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 11, padding: '3px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                    {activeImg + 1} / {listing.image_paths.length}
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 48 }}>🏠</div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '24px 28px', display: 'flex', gap: 28 }}>

              {/* Left — main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', lineHeight: 1.3 }}>{listing.title}</h1>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{formatPrice(listing.price_total_czk)}</div>
                    {listing.utilities_czk > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>nájem {formatPrice(listing.price_czk)} + zálohy {listing.utilities_czk.toLocaleString('cs-CZ')} Kč</div>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 14, color: 'var(--c-muted)', marginBottom: 16 }}>
                  {listing.address_street}{listing.address_district ? `, ${listing.address_district}` : ''} · {listing.address_city}
                </p>

                {/* Key stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    ['Dispozice', PROPERTY_TYPE_LABELS[listing.property_type]],
                    ['Plocha', `${listing.area_sqm} m²`],
                    listing.floor != null ? ['Patro', `${listing.floor}. patro`] : null,
                    ['Dostupné od', formatDate(listing.available_from)],
                    ['Min. nájem', `${listing.min_lease_months} měs.`],
                    listing.deposit_czk ? ['Kauce', `${listing.deposit_czk.toLocaleString('cs-CZ')} Kč`] : null,
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 10, color: 'var(--c-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {amenities.map(a => (
                      <span key={a as string} style={{ padding: '4px 10px', background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 20, fontSize: 12, color: 'var(--c-text)' }}>{a}</span>
                    ))}
                  </div>
                )}

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Popis</h3>
                  <p style={{ fontSize: 14, color: 'var(--c-text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{listing.description}</p>
                </div>

                {/* Thumbnail strip */}
                {listing.image_paths.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {listing.image_paths.map((path, i) => (
                      <img key={i} src={getImageUrl(path)} alt="" onClick={() => setActiveImg(i)}
                        style={{ width: 56, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: i === activeImg ? '2px solid #2563eb' : '1px solid var(--c-border)', opacity: i === activeImg ? 1 : 0.7, transition: 'all 0.15s' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right — contact card */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, position: 'sticky', top: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {listing.owner?.avatar_url
                        ? <img src={listing.owner.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                        : '👤'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{listing.owner?.display_name ?? 'Majitel'}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>Soukromá osoba</div>
                    </div>
                  </div>

                  {user ? (
                    showPhone ? (
                      <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#15803d', marginBottom: 4 }}>Telefon</div>
                        <a href={`tel:${listing.owner?.phone}`} style={{ fontSize: 16, fontWeight: 600, color: '#15803d', textDecoration: 'none' }}>
                          {listing.owner?.phone || '—'}
                        </a>
                      </div>
                    ) : (
                      <button onClick={() => setShowPhone(true)} style={{ width: '100%', padding: '10px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        📞 Zobrazit telefon
                      </button>
                    )
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 10, lineHeight: 1.5 }}>Pro zobrazení kontaktu se přihlas</p>
                      <button style={{ width: '100%', padding: '9px 0', background: 'var(--c-text)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                        Přihlásit se
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c-border)', fontSize: 11, color: 'var(--c-faint)', lineHeight: 1.6 }}>
                    Inzerce bez realitky. Kontaktuj přímo majitele — žádná provize.
                  </div>

                  <div style={{ marginTop: 12, fontSize: 11, color: 'var(--c-faint)' }}>
                    Přidáno {formatDate(listing.created_at)}
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