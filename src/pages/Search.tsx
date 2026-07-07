import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ListingSearchResult, SearchFilters } from '../lib/types'
import { ListingCard } from '../components/ListingCard'
import { Map } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'

type BBox = { west: number; south: number; east: number; north: number }
const STATUS_RANK = { green: 0, yellow: 1, red: 2, grey: 3 } as const

interface Props {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  showMap: boolean
  onToggleMap: () => void
}

export function SearchPage({ filters, onChange, showMap, onToggleMap }: Props) {
  const [listings, setListings] = useState<ListingSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [bbox, setBbox] = useState<BBox | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchListings = useCallback(async (f: SearchFilters, b: BBox | null) => {
    // ── No transit line selected: plain filtered query ──
    if (f.transitLines.length === 0) {
      let q = supabase.from('listings')
        .select('id,title,price_total_czk,property_type,area_sqm,address_district,available_from,image_paths')
        .eq('status', 'published')

      if (f.maxPrice > 0) q = q.lte('price_total_czk', f.maxPrice)
      if (f.minArea > 0) q = q.gte('area_sqm', f.minArea)
      if (f.propertyTypes.length > 0) q = q.in('property_type', f.propertyTypes)
      if (f.districts.length > 0) q = q.in('address_district', f.districts)
      if (f.furnished) q = q.eq('furnished', true)
      if (f.petsAllowed) q = q.eq('pets_allowed', true)
      if (f.parking) q = q.eq('parking', true)
      if (f.balcony) q = q.eq('balcony', true)

      const { data, error } = await q.order('price_total_czk').limit(150)
      if (error) { console.error(error); setListings([]); return }

      setListings((data ?? []).map((l: any) => ({
        ...l, listing_id: l.id, lat: 0, lng: 0,
        nearest_station_name: '—', nearest_station_line: '—',
        nearest_station_metres: 0, transit_status: 'grey' as const,
      })))
      return
    }

    // ── One or more transit lines: run RPC per line, merge keeping best status ──
    const results = await Promise.all(
      f.transitLines.map(line =>
        (supabase.rpc as any)('search_listings_with_transit', {
          p_line: line,
          p_max_price: f.maxPrice,
          p_property_type: null, // filtered client-side below for multi-type support
          p_bbox: b ?? null,
        }).then((r: any) => r.data ?? [])
      )
    )

    const merged = new globalThis.Map<string, ListingSearchResult>()
    for (const batch of results) {
      for (const item of batch as ListingSearchResult[]) {
        const existing = merged.get(item.listing_id)
        if (!existing || STATUS_RANK[item.transit_status] < STATUS_RANK[existing.transit_status]) {
          merged.set(item.listing_id, item)
        }
      }
    }

    let arr = [...merged.values()]

    // Client-side filters not covered by the RPC (multi-type, multi-district, area, amenities)
    if (f.propertyTypes.length > 0) arr = arr.filter(l => f.propertyTypes.includes(l.property_type))
    if (f.districts.length > 0) arr = arr.filter(l => l.address_district && f.districts.includes(l.address_district))
    if (f.minArea > 0) arr = arr.filter(l => l.area_sqm >= f.minArea)

    // Amenity filters require a fetch since RPC doesn't return them — fetch matching ids if any amenity active
    if (f.furnished || f.petsAllowed || f.parking || f.balcony) {
      const ids = arr.map(l => l.listing_id)
      if (ids.length > 0) {
        let aq = supabase.from('listings').select('id').in('id', ids)
        if (f.furnished) aq = aq.eq('furnished', true)
        if (f.petsAllowed) aq = aq.eq('pets_allowed', true)
        if (f.parking) aq = aq.eq('parking', true)
        if (f.balcony) aq = aq.eq('balcony', true)
        const { data: matchedIds } = await aq
        const allowSet = new Set((matchedIds ?? []).map((r: any) => r.id))
        arr = arr.filter(l => allowSet.has(l.listing_id))
      }
    }

    arr.sort((a, b) => STATUS_RANK[a.transit_status] - STATUS_RANK[b.transit_status] || a.price_total_czk - b.price_total_czk)
    setListings(arr)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      await fetchListings(filters, bbox)
      setLoading(false)
    }, 300)
  }, [filters, bbox, fetchListings])

  const handleMarkerClick = useCallback((id: string) => {
    setHighlightedId(id)
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const inArea = listings.filter(l => l.transit_status !== 'grey')
  const outArea = listings.filter(l => l.transit_status === 'grey')

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>

      {showMap && (
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <Map
            listings={listings.filter(l => l.lat !== 0)}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            onBoundsChange={setBbox}
            activeLines={filters.transitLines}
            activeDistricts={filters.districts}
          />
        </div>
      )}

      <div style={{
        width: showMap ? '50%' : '100%',
        display: 'flex', flexDirection: 'column',
        borderLeft: showMap ? '1px solid var(--c-border)' : 'none',
        background: 'var(--c-bg)', overflow: 'hidden', flexShrink: 0,
      }}>
        <FilterPanel filters={filters} onChange={onChange} resultCount={listings.length} loading={loading} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '6px 12px', borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)', flexShrink: 0,
        }}>
          <button onClick={onToggleMap} style={{
            padding: '4px 10px', border: '1px solid var(--c-border)', borderRadius: 6,
            background: 'transparent', fontSize: 11, color: 'var(--c-muted)', cursor: 'pointer',
          }}>
            {showMap ? '🗺 Skrýt mapu' : '🗺 Zobrazit mapu'}
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: 78, borderRadius: 10, background: 'var(--c-surface)', border: '1px solid var(--c-border)', opacity: 0.6 }} />
              ))}
            </div>
          )}

          {!loading && listings.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <span style={{ fontSize: 32 }}>🔍</span>
              <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>Žádné inzeráty</span>
              <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>Zkus upravit filtry</span>
            </div>
          )}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {inArea.map(l => (
                <div key={l.listing_id} data-id={l.listing_id}>
                  <ListingCard listing={l} highlighted={highlightedId === l.listing_id}
                    onClick={() => setHighlightedId(l.listing_id === highlightedId ? null : l.listing_id)} />
                </div>
              ))}
              {outArea.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                    <span style={{ fontSize: 10, color: 'var(--c-faint)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Mimo vybranou oblast
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                  </div>
                  {outArea.map(l => (
                    <div key={l.listing_id} data-id={l.listing_id}>
                      <ListingCard listing={l} highlighted={highlightedId === l.listing_id}
                        onClick={() => setHighlightedId(l.listing_id === highlightedId ? null : l.listing_id)} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}