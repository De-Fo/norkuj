import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ListingSearchResult, SearchFilters } from '../lib/types'
import { DEFAULT_FILTERS } from '../lib/types'
import { SearchFiltersPanel } from '../components/SearchFilters'
import { ListingCard } from '../components/ListingCard'
import { Map } from '../components/Map'

type BBox = { west: number; south: number; east: number; north: number }

export function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS)
  const [listings, setListings] = useState<ListingSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [bbox, setBbox] = useState<BBox | null>(null)
  const [showMap, setShowMap] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchListings = useCallback(async (f: SearchFilters, b: BBox | null) => {
    // Need at least a transit line selected to use the proximity function
    if (!f.transitLine) {
      // Fallback: simple query without transit scoring
      const query = supabase
        .from('listings')
        .select('id, title, price_total_czk, property_type, area_sqm, address_district, available_from, image_paths')
        .eq('status', 'published')

      if (f.maxPrice > 0) query.lte('price_total_czk', f.maxPrice)
      if (f.propertyType) query.eq('property_type', f.propertyType)
      if (f.furnished) query.eq('furnished', true)
      if (f.petsAllowed) query.eq('pets_allowed', true)
      if (f.parking) query.eq('parking', true)

      const { data } = await query.order('price_total_czk').limit(100)
      // Map to partial ListingSearchResult (no transit data)
      const mapped = (data ?? []).map((l: any) => ({
        ...l,
        listing_id: l.id,
        lat: 0, lng: 0,
        nearest_station_name: '—',
        nearest_station_line: '—',
        nearest_station_metres: 0,
        transit_status: 'grey' as const,
      }))
      setListings(mapped)
      return
    }

    const { data, error } = await supabase.rpc('search_listings_with_transit', {
      p_line: f.transitLine,
      p_max_price: f.maxPrice,
      p_property_type: f.propertyType ?? null,
      p_bbox: b ?? null,
    })

    if (error) { console.error(error); return }
    setListings((data ?? []) as ListingSearchResult[])
  }, [])

  // Debounced search on filter change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      await fetchListings(filters, bbox)
      setLoading(false)
    }, 350)
  }, [filters, bbox, fetchListings])

  const handleMarkerClick = useCallback((id: string) => {
    setHighlightedId(id)
    // Scroll card into view
    const el = listRef.current?.querySelector(`[data-id="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Split listings into in-area vs grey
  const inArea = listings.filter(l => l.transit_status !== 'grey')
  const outArea = listings.filter(l => l.transit_status === 'grey')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Filters sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 overflow-hidden">
        <SearchFiltersPanel filters={filters} onChange={setFilters} />
      </aside>

      {/* Results list */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Hledám...' : `${listings.length} inzerátů`}
          </span>
          <button
            onClick={() => setShowMap(v => !v)}
            className="text-xs px-2 py-1 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 md:hidden"
          >
            {showMap ? 'Skrýt mapu' : 'Zobrazit mapu'}
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!loading && listings.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-sm">Žádné inzeráty nenalezeny</p>
              <p className="text-xs mt-1">Zkus upravit filtry</p>
            </div>
          )}

          {!loading && inArea.map(l => (
            <div key={l.listing_id} data-id={l.listing_id}>
              <ListingCard
                listing={l}
                isHighlighted={highlightedId === l.listing_id}
                onClick={() => setHighlightedId(l.listing_id)}
              />
            </div>
          ))}

          {!loading && outArea.length > 0 && (
            <>
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-gray-300" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap px-2">
                  Mimo vybranou oblast
                </span>
                <div className="flex-1 h-px bg-gray-300" />
              </div>
              {outArea.map(l => (
                <div key={l.listing_id} data-id={l.listing_id}>
                  <ListingCard
                    listing={l}
                    isHighlighted={highlightedId === l.listing_id}
                    onClick={() => setHighlightedId(l.listing_id)}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <div className="flex-1 relative">
          <Map
            listings={listings.filter(l => l.lat !== 0)}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            onBoundsChange={setBbox}
          />
        </div>
      )}
    </div>
  )
}