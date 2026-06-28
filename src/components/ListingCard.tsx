import type { ListingSearchResult, TransitStatus } from '../lib/types'
import { formatPrice, getImageUrl } from '../lib/utils'

const CFG: Record<TransitStatus, { bar: string; badge: string; text: string; dot: string }> = {
  green:  { bar: '#16a34a', badge: '#dcfce7', text: '#15803d', dot: '#16a34a' },
  yellow: { bar: '#ca8a04', badge: '#fef9c3', text: '#a16207', dot: '#ca8a04' },
  red:    { bar: '#dc2626', badge: '#fee2e2', text: '#b91c1c', dot: '#dc2626' },
  grey:   { bar: '#9ca3af', badge: '#f1f5f9', text: '#64748b', dot: '#9ca3af' },
}

export function ListingCard({ listing, highlighted, onClick }: {
  listing: ListingSearchResult; highlighted?: boolean; onClick?: () => void
}) {
  const c = CFG[listing.transit_status]
  const thumb = listing.image_paths?.[0] ? getImageUrl(listing.image_paths[0]) : null

  return (
    <div onClick={onClick} style={{
      display: 'flex', gap: 10,
      background: 'var(--c-surface)',
      border: highlighted ? '1.5px solid var(--c-accent)' : '1px solid var(--c-border)',
      borderRadius: 10, padding: '9px 10px 9px 13px',
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
      boxShadow: highlighted ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 0.13s',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: c.bar, borderRadius: '10px 0 0 10px',
      }} />

      <div style={{
        width: 64, height: 56, borderRadius: 7, background: 'var(--c-bg)',
        flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 22, opacity: 0.2 }}>🏠</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
            {listing.property_type} · {listing.area_sqm} m²
            {listing.address_district ? ` · ${listing.address_district}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{formatPrice(listing.price_total_czk)}</span>
          {listing.nearest_station_name !== '—' && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 10, padding: '2px 7px', borderRadius: 9,
              background: c.badge, color: c.text,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
              {listing.nearest_station_name} · {listing.nearest_station_metres} m
            </span>
          )}
        </div>
      </div>
    </div>
  )
}