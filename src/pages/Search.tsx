import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ListingSearchResult, SearchFilters, TransitStatus } from '../lib/types'
import { ListingCard } from '../components/ListingCard'
import { Map } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { expandDistricts } from '../lib/districts'
import { convexHull, expandHull, pointInConvexPolygon } from '../lib/isochrone'

type BBox = { west: number; south: number; east: number; north: number }
const STATUS_RANK = { green: 0, yellow: 1, red: 2, grey: 3 } as const

function pointInBBox(lat: number, lng: number, b: BBox): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east
}

interface Props {
  filters: SearchFilters
  onChange: (f: SearchFilters) => void
  showMap: boolean
  onToggleMap: () => void
  onListingClick: (id: string) => void
}

export function SearchPage({ filters, onChange, showMap, onToggleMap, onListingClick }: Props) {
  const [listings, setListings] = useState<ListingSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [bbox, setBbox] = useState<BBox | null>(null)
  const [isoCenter, setIsoCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [isoMinutes, setIsoMinutes] = useState(10)
  const [isoPolygon, setIsoPolygon] = useState<[number, number][] | null>(null)
  const [isoLoading, setIsoLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isoFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchListings = useCallback(async (f: SearchFilters, b: BBox | null) => {
    // ═══════════════════════════════════════════════════════════════
    // 1. Always fetch all published listings as the base
    // ═══════════════════════════════════════════════════════════════
    const { data: baseData, error } = await (supabase.rpc as any)('get_published_listings_with_coords')
    if (error) { console.error(error); setListings([]); return }
    let base = (baseData ?? []) as any[]

    // ── Expand districts once ──
    const expandedDistricts = expandDistricts(f.districts)
    const inExpandedDistrict = (l: any): boolean => {
      if (expandedDistricts.length === 0) return true
      if (!l.address_district) return false
      const listingDists = l.address_district.split(',').map((s: string) => s.trim())
      return listingDists.some((d: string) => expandedDistricts.includes(d))
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. Fetch transit proximity for each selected line
    // ═══════════════════════════════════════════════════════════════
    const hasTransit = f.transitLines.length > 0
    const transitInfo = new globalThis.Map<string, {
      nearTransit: boolean; stationName: string; stationLine: string; metres: number
    }>()

    if (hasTransit) {
      const results = await Promise.all(
        f.transitLines.map(line =>
          (supabase.rpc as any)('search_listings_with_transit', {
            p_line: line,
            p_max_price: 0,           // no price filtering in RPC — done client-side
            p_property_type: null,     // no type filtering in RPC — done client-side
            p_bbox: null,              // no bbox filtering in RPC — done client-side
          }).then((r: any) => r.data ?? [])
        )
      )

      for (const batch of results) {
        for (const item of batch as any[]) {
          const lid = item.listing_id ?? item.id
          const newMetres = item.metres ?? item.nearest_station_metres ?? Infinity
          const existing = transitInfo.get(lid)
          const oldMetres = existing?.metres ?? Infinity
          if (!existing || newMetres < oldMetres) {
            transitInfo.set(lid, {
              nearTransit: newMetres <= 500,
              stationName: item.station_name ?? item.nearest_station_name ?? '—',
              stationLine: item.line ?? item.nearest_station_line ?? '—',
              metres: newMetres === Infinity ? 0 : newMetres,
            })
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. Merge transit info + compute smart color
    // ═══════════════════════════════════════════════════════════════
    const merged = base.map((l: any): ListingSearchResult => {
      const info = transitInfo.get(l.id)
      const near = info?.nearTransit ?? false
      const inDist = inExpandedDistrict(l)
      const hasDist = expandedDistricts.length > 0

      let status: TransitStatus
      if (hasTransit && hasDist) {
        // Both filters active → 4-color system
        if (inDist && near)       status = 'green'
        else if (inDist && !near) status = 'yellow'
        else if (!inDist && near) status = 'red'
        else                      status = 'grey'
      } else if (hasTransit) {
        // Only transit filter active
        status = near ? 'green' : 'grey'
      } else if (hasDist) {
        // Only district filter active
        status = inDist ? 'yellow' : 'grey'
      } else {
        status = 'grey'
      }

      return {
        ...l,
        listing_id: l.id,
        nearest_station_name: info?.stationName ?? '—',
        nearest_station_line: info?.stationLine ?? '—',
        nearest_station_metres: info?.metres ?? 0,
        transit_status: status,
      }
    })

    // ═══════════════════════════════════════════════════════════════
    // 4. Hard filters (price, area, type, amenities, bbox)
    // ═══════════════════════════════════════════════════════════════
    let filtered = [...merged]

    // District is a hard filter ONLY when transit is NOT active
    if (!hasTransit && expandedDistricts.length > 0) {
      filtered = filtered.filter(l => inExpandedDistrict(l))
    }

    if (f.minPrice > 0) filtered = filtered.filter(l => l.price_total_czk >= f.minPrice)
    if (f.maxPrice > 0) filtered = filtered.filter(l => l.price_total_czk <= f.maxPrice)
    if (f.minArea > 0) filtered = filtered.filter(l => l.area_sqm >= f.minArea)
    if (f.propertyTypes.length > 0) filtered = filtered.filter(l => f.propertyTypes.includes(l.property_type))

    if (f.furnished || f.petsAllowed || f.parking || f.balcony) {
      const ids = filtered.map(l => l.listing_id)
      if (ids.length > 0) {
        let aq = supabase.from('listings').select('id').in('id', ids)
        if (f.furnished) aq = aq.eq('furnished', true)
        if (f.petsAllowed) aq = aq.eq('pets_allowed', true)
        if (f.parking) aq = aq.eq('parking', true)
        if (f.balcony) aq = aq.eq('balcony', true)
        const { data: matchedIds } = await aq
        const allowSet = new Set((matchedIds ?? []).map((r: any) => r.id))
        filtered = filtered.filter(l => allowSet.has(l.listing_id))
      }
    }

    if (b && f.filterByMapArea) {
      filtered = filtered.filter(l => l.lat != null && l.lng != null && pointInBBox(l.lat, l.lng, b))
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. Sort — green → yellow → red → grey
    // ═══════════════════════════════════════════════════════════════
    if (hasTransit) {
      filtered.sort((a, b) => STATUS_RANK[a.transit_status] - STATUS_RANK[b.transit_status] || a.price_total_czk - b.price_total_czk)
    } else {
      filtered.sort((a, b) => a.price_total_czk - b.price_total_czk)
    }

    setListings(filtered)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      // Only apply bbox filtering when the toggle is on
      const effectiveBbox = filters.filterByMapArea ? bbox : null
      await fetchListings(filters, effectiveBbox)
      setLoading(false)
    }, 300)
  }, [filters, bbox, fetchListings])

  const handleMarkerClick = useCallback((id: string) => {
    setHighlightedId(id)
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // ── Isochrone: fetch from Supabase RPC and compute polygon ──
  const fetchIsochrone = useCallback(async (lat: number, lng: number, minutes: number) => {
    setIsoLoading(true)
    try {
      const { data, error } = await (supabase.rpc as any)('calculate_isochrone', {
        p_lat: lat,
        p_lng: lng,
        p_minutes: minutes,
      })
      if (error || !data || data.length === 0) {
        console.error('[Isochrone] error:', error)
        setIsoPolygon(null)
        return
      }
      // Build convex hull from stop coordinates [lng, lat]
      const points: [number, number][] = (data as any[])
        .filter((s: any) => s.lat && s.lon)
        .map((s: any) => [s.lon, s.lat])
      if (points.length >= 3) {
        setIsoPolygon(expandHull(convexHull(points), 0.003))
      } else {
        setIsoPolygon(null)
      }
    } catch (err) {
      console.error('[Isochrone] fetch failed:', err)
      setIsoPolygon(null)
    }
    setIsoLoading(false)
  }, [])

  // Debounced isochrone fetch
  const scheduleIsochrone = useCallback((lat: number, lng: number, minutes: number) => {
    if (isoFetchRef.current) clearTimeout(isoFetchRef.current)
    isoFetchRef.current = setTimeout(() => fetchIsochrone(lat, lng, minutes), 400)
  }, [fetchIsochrone])

  // Handle map click for isochrone
  const handleIsochroneMapClick = useCallback((lat: number, lng: number) => {
    setIsoCenter({ lat, lng })
    scheduleIsochrone(lat, lng, isoMinutes)
  }, [isoMinutes, scheduleIsochrone])
  // ── Apply isochrone polygon filter if active ──
  const listingsFilteredByIso = isoPolygon && isoPolygon.length >= 3
    ? listings.filter(l => l.lat && l.lng && pointInConvexPolygon([l.lng, l.lat], isoPolygon))
    : listings

  const hasTransitFilter = filters.transitLines.length > 0
  const hasDistFilter = filters.districts.length > 0
  const hasColoring = hasTransitFilter || hasDistFilter

  // For rendering: split into "in" (green/yellow) and "out" (red/grey)
  // When only transit filter is active: green = near, grey = far
  // When only district filter is active: yellow = in district, grey = out
  // When both active: green = both, yellow = district only, red = transit only, grey = neither
  const inArea = hasColoring
    ? listingsFilteredByIso.filter(l => l.transit_status === 'green' || l.transit_status === 'yellow')
    : listingsFilteredByIso
  const outArea = hasColoring
    ? listingsFilteredByIso.filter(l => l.transit_status === 'red' || l.transit_status === 'grey')
    : []

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>

      {showMap && (
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <Map
            listings={listingsFilteredByIso.filter(l => l.lat !== 0)}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            onBoundsChange={setBbox}
            activeLines={filters.transitLines}
            activeDistricts={filters.districts}
            isochronePolygon={isoPolygon}
            isochroneCenter={isoCenter}
            onIsochroneClick={handleIsochroneMapClick}
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

        {/* Isochrone control bar */}
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          {isoCenter ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
                📍 {isoCenter.lat.toFixed(4)}, {isoCenter.lng.toFixed(4)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>⏱</span>
              <input type="number" min={1} max={120} value={isoMinutes}
                onChange={e => {
                  const m = Math.max(1, Math.min(120, parseInt(e.target.value) || 1))
                  setIsoMinutes(m)
                  if (isoCenter && e.target.value) {
                    if ((window as any)._isoTimer) clearTimeout((window as any)._isoTimer)
                    ;(window as any)._isoTimer = setTimeout(() => scheduleIsochrone(isoCenter.lat, isoCenter.lng, m), 500)
                  }
                }}
                style={{
                  width: 48, padding: '2px 6px', border: '1px solid var(--c-border)',
                  borderRadius: 4, fontSize: 12, color: 'var(--c-text)', background: 'white',
                  outline: 'none', textAlign: 'center',
                }} />
              <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>min</span>
              {isoLoading && <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>⏳</span>}
              <button onClick={() => { setIsoCenter(null); setIsoPolygon(null) }}
                style={{
                  padding: '2px 7px', border: '1px solid var(--c-border)', borderRadius: 4,
                  background: 'transparent', fontSize: 10, color: 'var(--c-muted)', cursor: 'pointer',
                  marginLeft: 'auto',
                }}>
                ✕ Zrušit
              </button>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>
              🖱 Klikni na mapu pro výpočet dojezdové vzdálenosti
            </span>
          )}
          <button onClick={onToggleMap} style={{
            padding: '4px 10px', border: '1px solid var(--c-border)', borderRadius: 6,
            background: 'transparent', fontSize: 11, color: 'var(--c-muted)', cursor: 'pointer',
            marginLeft: isoCenter ? 0 : 'auto',
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
                    onClick={() => onListingClick(l.listing_id)} />
                </div>
              ))}
              {/* Divider only renders when coloring filters are active AND there are out-of-area results */}
              {hasColoring && outArea.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                    <span style={{ fontSize: 10, color: 'var(--c-faint)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Ostatní
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                  </div>
                  {outArea.map(l => (
                    <div key={l.listing_id} data-id={l.listing_id}>
                      <ListingCard listing={l} highlighted={highlightedId === l.listing_id}
                        onClick={() => onListingClick(l.listing_id)} />
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