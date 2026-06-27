import type { ListingSearchResult } from '../lib/types'
import { TRANSIT_BORDER_CLASS, TRANSIT_BADGE_CLASS, TRANSIT_LABEL, formatPrice, formatDate, getImageUrl } from '../lib/utils'

interface ListingCardProps {
  listing: ListingSearchResult
  isHighlighted?: boolean
  onClick?: () => void
}

export function ListingCard({ listing, isHighlighted, onClick }: ListingCardProps) {
  const borderClass = TRANSIT_BORDER_CLASS[listing.transit_status]
  const badgeClass = TRANSIT_BADGE_CLASS[listing.transit_status]
  const label = TRANSIT_LABEL[listing.transit_status]

  const thumb = listing.image_paths[0]
    ? getImageUrl(listing.image_paths[0])
    : null

  return (
    <div
      onClick={onClick}
      className={`
        flex gap-3 bg-white rounded-xl p-3 cursor-pointer border border-transparent
        ${borderClass}
        ${isHighlighted ? 'ring-2 ring-blue-500 shadow-md' : 'shadow-sm hover:shadow-md'}
        transition-all duration-150
      `}
    >
      {/* Thumbnail */}
      <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100">
        {thumb ? (
          <img src={thumb} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">🏠</div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm text-gray-900 truncate">{listing.title}</p>
            <span className="text-sm font-bold text-blue-700 shrink-0">{formatPrice(listing.price_total_czk)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {listing.property_type} · {listing.area_sqm} m² · {listing.address_district ?? 'Praha'}
          </p>
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {label} {listing.nearest_station_name} ({listing.nearest_station_metres} m)
          </span>
          <span className="text-xs text-gray-400">od {formatDate(listing.available_from)}</span>
        </div>
      </div>
    </div>
  )
}