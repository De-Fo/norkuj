import type { ListingSearchResult, TransitStatus } from '../lib/types'
import { formatPrice, getImageUrl } from '../lib/utils'
import { PROPERTY_TYPE_LABELS } from '../lib/types'
import { useLang } from '../lib/lang'

const CFG: Record<TransitStatus, { bar: string; badge: string; text: string; dot: string }> = {
  green:  { bar: '#16a34a', badge: '#dcfce7', text: '#15803d', dot: '#16a34a' },
  yellow: { bar: '#ca8a04', badge: '#fef9c3', text: '#a16207', dot: '#ca8a04' },
  red:    { bar: '#dc2626', badge: '#fee2e2', text: '#b91c1c', dot: '#dc2626' },
  grey:   { bar: '#9ca3af', badge: '#f1f5f9', text: '#64748b', dot: '#9ca3af' },
}
const FALLBACK_BAR = '#9ca3af'

export function ListingCard({ listing, highlighted, onClick }: {
  listing: ListingSearchResult; highlighted?: boolean; onClick?: () => void
}) {
  const { t } = useLang()
  // Notification previews feed compact rows without transit geometry (no
  // transit_status / nearest_station_*). Fall back so the card never crashes.
  const status: TransitStatus = listing.transit_status in CFG ? listing.transit_status : 'grey'
  const c = CFG[status]
  const bar = c?.bar ?? FALLBACK_BAR
  const thumb = listing.image_paths?.[0] ? getImageUrl(listing.image_paths[0]) : null
  const station = listing.nearest_station_name && listing.nearest_station_name !== '—' ? listing.nearest_station_name : null

  const availableNow = listing.available_from ? new Date(listing.available_from).getTime() <= Date.now() : false

  return (
    <div onClick={onClick} className="listing-card" data-highlighted={highlighted ? 'true' : undefined} style={{
      display: 'flex', gap: 12,
      background: 'var(--c-surface)',
      border: highlighted ? '2px solid var(--c-accent)' : '1px solid var(--c-border)',
      borderRadius: 3, padding: highlighted ? '8px 11px 8px 14px' : '9px 12px 9px 15px',
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: bar }} />

      <div style={{
        width: 76, height: 64, borderRadius: 2, background: 'var(--c-bg)',
        flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb
          ? <img src={thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 22, opacity: 0.2 }}>🏠</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
            {listing.title}
          </div>
          <div className="num" style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 2 }}>
            {PROPERTY_TYPE_LABELS[listing.property_type]} · {listing.area_sqm} m²
            {listing.address_district ? ` · ${listing.address_district}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <span className="num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>{formatPrice(listing.price_total_czk)}</span>
            {availableNow && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-green-text)', whiteSpace: 'nowrap' }}>{t('available_now')}</span>}
          </span>
          {station && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 2, background: c.badge, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: c.dot, flexShrink: 0 }} />
              {station}{listing.nearest_station_metres ? ` · ${listing.nearest_station_metres} m` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
