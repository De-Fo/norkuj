import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing } from '../lib/types'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { formatPrice, formatDate, getImageUrl } from '../lib/utils'

interface OwnerInfo {
  display_name: string
  phone: string
  avatar_url: string | null
}

interface FullListing extends Listing {
  owner?: OwnerInfo
}

interface Props {
  listingId: string
  onClose: () => void
  onRequestAuth?: () => void
}

export function ListingDetail({ listingId, onClose, onRequestAuth }: Props) {
  const [listing, setListing] = useState<FullListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [showContact, setShowContact] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('listings')
        .select('*, owner:profiles(display_name, phone, avatar_url)')
        .eq('id', listingId)
        .single()
      if (err) {
        console.error('ListingDetail fetch error:', err)
        setError('Inzerát se nepodařilo načíst.')
      } else {
        setListing(data as FullListing)
      }
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
    listing.furnished    && 'Zařízený',
    listing.pets_allowed && 'Zvířata OK',
    listing.parking      && 'Parkování',
    listing.balcony      && 'Balkon',
    listing.cellar       && 'Sklep',
  ].filter(Boolean) : []

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '80%', maxWidth: 900, height: '85vh', background: 'white', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', position: 'relative' }}>

        {/* Close button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', color: 'white', fontSize: 16, cursor: 'pointer', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

        {/* Loading */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #2563eb', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 32 }}>😕</span>
            <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
            <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Zavřít</button>
          </div>
        )}

        {/* Content */}
        {listing && !loading && (
          <div style={{ flex: 1, overflow: 'auto' }}>

            {/* Photo gallery */}
            <div style={{ position: 'relative', height: 300, background: '#0f172a', flexShrink: 0, overflow: 'hidden' }}>
              {listing.image_paths.length > 0 ? (
                <>
                  <img
                    src={getImageUrl(listing.image_paths[activeImg])}
                    alt={listing.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }}
                  />
                  {/* Counter */}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 11, padding: '3px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                    {activeImg + 1} / {listing.image_paths.length}
                  </div>
                  {/* Arrows */}
                  {listing.image_paths.length > 1 && (
                    <>
                      <button onClick={() => setActiveImg(i => (i - 1 + listing.image_paths.length) % listing.image_paths.length)}
                        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>‹</button>
                      <button onClick={() => setActiveImg(i => (i + 1) % listing.image_paths.length)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.4)', color: 'white', fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>›</button>
                      {/* Dots */}
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
            <div style={{ padding: '24px 28px', display: 'flex', gap: 28 }}>

              {/* Left column */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Title + Price */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, margin: 0 }}>{listing.title}</h1>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>{formatPrice(listing.price_total_czk)}</div>
                    {listing.utilities_czk > 0 && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        nájem {formatPrice(listing.price_czk)} + zálohy {listing.utilities_czk.toLocaleString('cs-CZ')} Kč
                      </div>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, margin: '0 0 20px' }}>
                  📍 {listing.address_street}{listing.address_district ? `, ${listing.address_district}` : ''}, Praha
                </p>

                {/* Stats */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
                  {([
                    ['Dispozice', PROPERTY_TYPE_LABELS[listing.property_type]],
                    ['Plocha', `${listing.area_sqm} m²`],
                    listing.floor != null ? ['Patro', `${listing.floor}. patro`] : null,
                    ['Dostupné od', formatDate(listing.available_from)],
                    ['Min. nájem', `${listing.min_lease_months} měs.`],
                    listing.deposit_czk ? ['Kauce', `${listing.deposit_czk.toLocaleString('cs-CZ')} Kč`] : null,
                  ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                    {amenities.map(a => (
                      <span key={a as string} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, fontSize: 12, color: '#0f172a' }}>{a}</span>
                    ))}
                  </div>
                )}

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Popis</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#0f172a', margin: 0 }}>{listing.description}</p>
                </div>

                {/* Thumbnail strip */}
                {listing.image_paths.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {listing.image_paths.map((path, i) => (
                      <img key={i} src={getImageUrl(path)} alt="" onClick={() => setActiveImg(i)}
                        style={{ width: 56, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: i === activeImg ? '2px solid #2563eb' : '1px solid #e2e8f0', opacity: i === activeImg ? 1 : 0.65, transition: 'all 0.15s' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right column — contact */}
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, position: 'sticky', top: 0 }}>

                  {/* Owner info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {listing.owner?.avatar_url
                        ? <img src={listing.owner.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <span style={{ fontSize: 20 }}>👤</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{listing.owner?.display_name ?? 'Majitel'}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Soukromá osoba</div>
                    </div>
                  </div>

                  {/* Contact logic */}
                  {user ? (
                    showContact ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {listing.owner?.phone ? (
                          <a href={`tel:${listing.owner.phone}`} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', background: '#f0fdf4',
                            border: '1px solid #86efac', borderRadius: 8,
                            textDecoration: 'none', color: '#15803d',
                          }}>
                            <span>📞</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{listing.owner.phone}</span>
                          </a>
                        ) : (
                          <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                            Majitel neuvedl telefon
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                          Kontaktuj přímo — žádná provize
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowContact(true)}
                        style={{ width: '100%', padding: '11px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        📞 Zobrazit kontakt
                      </button>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                        Pro zobrazení kontaktu se přihlas zdarma
                      </p>
                      <button
                        onClick={() => { onClose(); onRequestAuth?.() }}
                        style={{ width: '100%', padding: '10px 0', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      >
                        Přihlásit se
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
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