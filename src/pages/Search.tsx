import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ListingSearchResult, SearchFilters, TransitStatus } from '../lib/types'
import { ListingCard } from '../components/ListingCard'
import { Map } from '../components/Map'
import { FilterPanel } from '../components/FilterPanel'
import { expandDistricts } from '../lib/districts'
import { pointInConvexPolygon } from '../lib/isochrone'
import { Footer } from '../components/Footer'
import { useLang } from '../lib/lang'

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
  isMobile?: boolean
  isochroneAutoShowMap?: () => void
  onSaveFilters?: () => void
}

export function SearchPage({ filters, onChange, showMap, onToggleMap, onListingClick, isMobile, isochroneAutoShowMap, onSaveFilters }: Props) {
  const { t } = useLang()
  const [listings, setListings] = useState<ListingSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [bbox, setBbox] = useState<BBox | null>(null)
  const [isoCenter, setIsoCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [isoMinutes, setIsoMinutes] = useState(10)
  const [isoPolygon, setIsoPolygon] = useState<[number, number][] | null>(null)
  const [isoLoading, setIsoLoading] = useState(false)
  const [isoModeActive, setIsoModeActive] = useState(false)  // toggle for isochrone map-click mode
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isoFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isoReqRef = useRef(0)

  const fetchListings = useCallback(async (f: SearchFilters, b: BBox | null) => {
    // Base data = all published listings; filtering happens on the client
    const { data: baseData, error } = await (supabase.rpc as any)('get_published_listings_with_coords')
    if (error) { if (import.meta.env.DEV) console.error(error); setListings([]); return }
    let base = (baseData ?? []) as any[]

    // ── Expand districts once ──
    const expandedDistricts = expandDistricts(f.districts)
    const inExpandedDistrict = (l: any): boolean => {
      if (expandedDistricts.length === 0) return true
      if (!l.address_district) return false
      const listingDists = l.address_district.split(',').map((s: string) => s.trim())
      return listingDists.some((d: string) => expandedDistricts.includes(d))
    }

    // Transit proximity for each selected line
    const hasTransit = f.transitLines.length > 0
    const transitInfo = new globalThis.Map<string, {
      nearTransit: boolean; stationName: string; stationLine: string; metres: number
    }>()

    if (hasTransit) {
      const results = await Promise.all(
        f.transitLines.map(line =>
          (supabase.rpc as any)('search_listings_with_transit', {
            p_line: line,
            p_max_price: 0,           // filtering stays client-side
            p_property_type: null,
            p_bbox: null,
          }).then((r: any) => {
            if (r.error && import.meta.env.DEV) console.error('[transit search]', r.error)
            return r.data ?? []
          })
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

    // Merge transit info + compute status (green/yellow/red/grey per filter combos)
    const merged = base.map((l: any): ListingSearchResult => {
      const info = transitInfo.get(l.id)
      const inDist = inExpandedDistrict(l)
      const hasDist = expandedDistricts.length > 0
      const metres = info?.metres ?? 0

      const hasMetres = metres > 0
      const near = hasMetres && metres <= 500
      const walkable = hasMetres && metres <= 1500

      let status: TransitStatus
      if (hasTransit && hasDist) {
        if (inDist && near)           status = 'green'   // in district AND near line
        else if (inDist)              status = 'yellow'  // in district only
        else if (near)                status = 'red'     // near line only
        else                          status = 'grey'    // neither
      } else if (hasTransit) {
        status = near   ? 'green' : walkable ? 'yellow' : 'grey'
      } else if (hasDist) {
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

    // Hard filters (price, area, type, amenities, bbox, transit+district)
    let filtered = [...merged]

    // With transit+district both active, grey (matching neither) is excluded
    if (hasTransit && expandedDistricts.length > 0) {
      filtered = filtered.filter(l => l.transit_status !== 'grey')
    } else if (!hasTransit && expandedDistricts.length > 0) {
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

    // Sort; transit mode ranks by status first, then the chosen field
    const sortField = f.sortBy ?? 'date'
    const sortDir = f.sortDir ?? 'desc'
    const dir = sortDir === 'desc' ? -1 : 1

    // When transit is active, primary sort is by status (green→yellow→red→grey)
    if (hasTransit) {
      filtered.sort((a, b) => {
        const statusDiff = STATUS_RANK[a.transit_status] - STATUS_RANK[b.transit_status]
        if (statusDiff !== 0) return statusDiff
        // tie-break by chosen field
        if (sortField === 'price') return (a.price_total_czk - b.price_total_czk) * dir
        if (sortField === 'area') return (a.area_sqm - b.area_sqm) * dir
        return ((a as any).created_at ?? '').localeCompare((b as any).created_at ?? '') * dir
      })
    } else {
      filtered.sort((a, b) => {
        if (sortField === 'price') return (a.price_total_czk - b.price_total_czk) * dir
        if (sortField === 'area') return (a.area_sqm - b.area_sqm) * dir
        // date — newest first by default
        return ((a as any).created_at ?? '').localeCompare((b as any).created_at ?? '') * dir
      })
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
    onListingClick(id)
  }, [onListingClick])

  // ── Isochrone: fetch from Supabase RPC and compute polygon ──
  const fetchIsochrone = useCallback(async (lat: number, lng: number, minutes: number) => {
    const reqNo = ++isoReqRef.current
    setIsoLoading(true)
    try {
      const { data, error } = await (supabase.rpc as any)('calculate_isochrone_polygon', {
        p_lat: lat,
        p_lng: lng,
        p_minutes: minutes,
        p_num_bins: 72,
      })
      // Discard stale response if a newer request was already started
      if (reqNo !== isoReqRef.current) {
        return
      }
      if (error || !data || (data as any[]).length < 3) {
        if (import.meta.env.DEV) console.error('[Isochrone] no polygon returned:', error)
        setIsoPolygon(null)
        return
      }
      const rawArr = data as [number, number][]
      setIsoPolygon(rawArr)
    } catch (err) {
      if (reqNo !== isoReqRef.current) return
      if (import.meta.env.DEV) console.error('[Isochrone] fetch failed:', err)
      setIsoPolygon(null)
    }
    setIsoLoading(false)
  }, [])

  // Debounced isochrone fetch
  const scheduleIsochrone = useCallback((lat: number, lng: number, minutes: number) => {
    if (isoFetchRef.current) clearTimeout(isoFetchRef.current)
    isoFetchRef.current = setTimeout(() => fetchIsochrone(lat, lng, minutes), 400)
  }, [fetchIsochrone])

  // Handle map click for isochrone — only when isoModeActive is on
  const handleIsochroneMapClick = useCallback((lat: number, lng: number) => {
    if (!isoModeActive) return
    setIsoModeActive(false)  // deactivate after one click so markers work again
    setIsoCenter({ lat, lng })
    // On mobile, auto-show map so user sees the isochrone polygon
    if (isMobile && isochroneAutoShowMap) isochroneAutoShowMap()
    scheduleIsochrone(lat, lng, isoMinutes)
  }, [isoModeActive, isoMinutes, scheduleIsochrone])
  // ── Apply isochrone polygon filter if active ──
  const listingsFilteredByIso = isoPolygon && isoPolygon.length >= 3
    ? listings.filter(l => l.lat && l.lng && pointInConvexPolygon([l.lng, l.lat], isoPolygon))
    : listings

  const hasTransitFilter = filters.transitLines.length > 0
  const hasDistFilter = filters.districts.length > 0
  const hasColoring = hasTransitFilter || hasDistFilter

  // For rendering: apply transit-status grouping when filters are active
  const inArea = hasColoring
    ? listingsFilteredByIso.filter(l => l.transit_status !== 'grey')
    : listingsFilteredByIso

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* SEO h1 - visually hidden, crawl-visible */}
      <h1 className="sr-only">{t('_search_h1')}</h1>

      {/* ── Map (desktop: side panel, mobile: full-height layer) ── */}
      {(!isMobile || showMap) && (
      <div style={{
        flex: isMobile ? undefined : 1,
        position: isMobile ? 'absolute' : 'relative',
        inset: isMobile ? 0 : undefined,
        zIndex: isMobile ? 10 : undefined,
        minWidth: isMobile ? '100%' : 0,
        maxWidth: isMobile ? '100%' : (showMap ? '50%' : '0%'),
        overflow: 'hidden',
        opacity: isMobile ? 1 : (showMap ? 1 : 0),
        transition: 'max-width 0.3s ease, opacity 0.2s ease',
      }}>
        {(!isMobile || showMap) && (
          <Map
            listings={listingsFilteredByIso.filter(l => l.lat !== 0)}
            highlightedId={highlightedId}
            onMarkerClick={handleMarkerClick}
            onMarkerHover={setHighlightedId}
            onBoundsChange={(b) => { if (filters.filterByMapArea) setBbox(b) }}
            activeLines={filters.transitLines}
            activeDistricts={filters.districts}
            isochronePolygon={isoPolygon}
            isochroneCenter={isoCenter}
            onIsochroneClick={handleIsochroneMapClick}
            t={t}
          />
        )}
      </div>
      )}

      {/* Mobile map overlay button — always above the map */}
      {isMobile && showMap && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          pointerEvents: 'none',
        }}>
          <button onClick={onToggleMap}
            style={{
              position: 'absolute', top: 8, left: 8,
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--c-surface)', color: 'var(--c-text)',
              border: '1px solid var(--c-border)', fontSize: 12, fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              pointerEvents: 'auto',
            }}>
            {t('mobile_list_btn_back')}
          </button>
        </div>
      )}

      <div style={{
        width: isMobile ? '100%' : (showMap ? '50%' : '100%'),
        maxWidth: (!isMobile && !showMap) ? 960 : undefined,
        margin: (!isMobile && !showMap) ? '0 auto' : undefined,
        display: 'flex', flexDirection: 'column',
        borderLeft: (!isMobile && showMap) ? '1px solid var(--c-border)' : 'none',
        background: 'var(--c-bg)', overflow: 'hidden', flexShrink: 0,
        zIndex: isMobile && showMap ? 5 : undefined,
      }}>
        <FilterPanel filters={filters} onChange={onChange} resultCount={listings.length} loading={loading} isMobile={isMobile} onSaveFilters={onSaveFilters} />

        {/* ── Toolbar: isochrone + sort + toggle map ── */}
        <div style={{
          padding: isMobile ? '6px 8px' : '8px 12px', borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          {isoCenter ? (
            <>
              <span style={{ fontSize: isMobile ? 11 : 11, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
                📍 {isoCenter.lat.toFixed(4)}, {isoCenter.lng.toFixed(4)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>⏱</span>
              <input type="number" min={1} max={120} value={isoMinutes}
                onChange={e => {
                  const m = Math.max(1, Math.min(120, parseInt(e.target.value) || 1))
                  setIsoMinutes(m)
                  if (isoCenter && e.target.value) {
                    scheduleIsochrone(isoCenter.lat, isoCenter.lng, m)
                  }
                }}
                style={{
                  width: 48, padding: isMobile ? '6px 6px' : '2px 6px', border: '1px solid var(--c-border)',
                  borderRadius: 4, fontSize: 12, color: 'var(--c-text)', background: 'var(--c-surface)',
                  outline: 'none', textAlign: 'center', minHeight: isMobile ? 36 : undefined,
                }} />
              <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>{t('iso_minutes')}</span>
              {isoLoading && <span style={{ fontSize: 10, color: 'var(--c-faint)' }}>{t('iso_loading')}</span>}
              <button onClick={() => { setIsoCenter(null); setIsoPolygon(null) }}
                style={{
                  padding: isMobile ? '6px 10px' : '2px 7px', border: '1px solid var(--c-border)', borderRadius: 4,
                  background: 'transparent', fontSize: 10, color: 'var(--c-muted)', cursor: 'pointer',
                  minHeight: isMobile ? 34 : undefined,
                }}>
                {t('iso_cancel')}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setIsoModeActive(v => !v)}
                style={{
                  padding: isMobile ? '7px 12px' : '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: isoModeActive ? 'none' : '1px solid var(--c-border)',
                  background: isoModeActive ? '#2563eb' : 'transparent',
                  color: isoModeActive ? '#fff' : 'var(--c-muted)',
                  fontSize: isMobile ? 12 : 11, fontWeight: isoModeActive ? 600 : 400,
                  whiteSpace: 'nowrap', minHeight: isMobile ? 36 : undefined,
                }}>
                {t('iso_label')}
              </button>
              {!isoModeActive &&
                <span style={{ fontSize: 10, color: 'var(--c-muted)', fontWeight: 500, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-accent)', opacity: 0.7, animation: 'pulse-iso 2s ease-in-out infinite' }} />
                  {t('iso_description')}
                </span>
              }
              {isoModeActive &&
                <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {t('iso_active')}
                </span>
              }
            </div>
          )}

          {/* Sort + map toggle — locked to right edge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6, marginLeft: 'auto', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <select value={filters.sortBy} onChange={e => onChange({ ...filters, sortBy: e.target.value as any })}
                aria-label={t('sort_label')}
                style={{
                  padding: isMobile ? '6px 8px' : '2px 6px', border: '1px solid var(--c-border)', borderRadius: 4,
                  fontSize: isMobile ? 11 : 10, color: 'var(--c-muted)', background: 'var(--c-surface)', outline: 'none',
                  minHeight: isMobile ? 34 : undefined,
                }}>
                <option value="date">{t('sort_date')}</option>
                <option value="price">{t('sort_price')}</option>
                <option value="area">{t('sort_area')}</option>
              </select>
              <button onClick={() => onChange({ ...filters, sortDir: filters.sortDir === 'desc' ? 'asc' : 'desc' })}
                aria-label={filters.sortDir === 'desc' ? t('sort_desc') : t('sort_asc')}
                title={filters.sortDir === 'desc' ? t('sort_desc') : t('sort_asc')}
                style={{
                  padding: isMobile ? '6px 8px' : '2px 6px', border: '1px solid var(--c-border)', borderRadius: 4,
                  background: 'transparent', fontSize: isMobile ? 13 : 11, color: 'var(--c-muted)', cursor: 'pointer',
                  lineHeight: 1.2, minHeight: isMobile ? 34 : undefined,
                }}>
                {filters.sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            <button onClick={onToggleMap} style={{
              padding: isMobile ? '7px 12px' : '4px 10px', border: '1px solid var(--c-border)', borderRadius: 6,
              background: showMap ? 'var(--c-surface)' : 'var(--c-accent)',
              color: showMap ? 'var(--c-text)' : 'white',
              fontSize: isMobile ? 12 : 11, cursor: 'pointer', fontWeight: 500,
              boxShadow: showMap ? 'none' : '0 0 0 2px color-mix(in srgb, var(--c-accent) 40%, transparent)',
              flexShrink: 0, minHeight: isMobile ? 36 : undefined,
              animation: showMap ? 'none' : 'pulse-map 2s ease-in-out infinite',
            }}>
              {isMobile ? (showMap ? t('mobile_list_btn') : t('mobile_map_btn')) : (showMap ? t('map_toggle_hide') : t('map_toggle_show'))}
            </button>
          </div>
        </div>

        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 8 : 10 }}>
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
              <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>{t('no_results')}</span>
              <span style={{ fontSize: 11, color: 'var(--c-faint)' }}>{t('no_results_hint')}</span>
            </div>
          )}

          {!loading && !hasColoring && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {listingsFilteredByIso.map(l => (
                <div key={l.listing_id} data-id={l.listing_id}>
                  <ListingCard listing={l} highlighted={highlightedId === l.listing_id}
                    onClick={() => onListingClick(l.listing_id)} />
                </div>
              ))}
            </div>
          )}

          {!loading && hasColoring && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Section labels depend on which filters are active */}
              {(() => {
                const hasBoth = hasTransitFilter && hasDistFilter
                const hasTransitOnly = hasTransitFilter && !hasDistFilter
                const hasDistOnly = !hasTransitFilter && hasDistFilter

                const sections: { key: TransitStatus; color: string; label: string }[] = []
                if (hasBoth) {
                  sections.push({ key: 'green', color: '#16a34a', label: '● ' + t('green') })
                  sections.push({ key: 'yellow', color: '#ca8a04', label: '● ' + t('yellow') })
                  sections.push({ key: 'red', color: '#dc2626', label: '● ' + t('red') })
                } else if (hasTransitOnly) {
                  sections.push({ key: 'green', color: '#16a34a', label: '● ' + t('green_transit_only') })
                  sections.push({ key: 'yellow', color: '#ca8a04', label: '● ' + t('yellow_transit_only') })
                } else if (hasDistOnly) {
                  sections.push({ key: 'yellow', color: '#ca8a04', label: '● ' + t('yellow_dist_only') })
                }

                return sections.map(s => (
                  <React.Fragment key={s.key}>
                    {inArea.some(l => l.transit_status === s.key) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                        <span style={{ fontSize: 10, color: s.color, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          {s.label}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--c-border-md)' }} />
                      </div>
                    )}
                    {inArea.filter(l => l.transit_status === s.key).map(l => (
                      <div key={l.listing_id} data-id={l.listing_id}>
                        <ListingCard listing={l} highlighted={highlightedId === l.listing_id}
                          onClick={() => onListingClick(l.listing_id)} />
                      </div>
                    ))}
                  </React.Fragment>
                ))
              })()}
            </div>
          )}

          {/* static SEO intro + FAQ block (crawlable, doubles as GEO content) */}
          <BeforeFooter />

          <Footer />
        </div>
      </div>
    </div>
  )
}

function BeforeFooter() {
  const { t } = useLang()
  return (
    <div style={{ padding: '24px 16px 8px', borderTop: '1px solid var(--c-border)', maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--c-text)' }}>{t('_search_h1')}</h2>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--c-text-secondary)', marginBottom: 16 }}>{t('_search_intro')}</p>

      {/* FAQ - the whole block is one collapsible unit */}
      <details style={{ margin: '16px 0 8px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)' }}>
        <summary style={{
          padding: '10px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 15,
          color: 'var(--c-text)', listStyle: 'none',
        }}>
          <span style={{ marginRight: 8 }}>▸</span>{t('_search_faq_h')}
        </summary>
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['_search_faq_q1', '_search_faq_a1'], ['_search_faq_q2', '_search_faq_a2'], ['_search_faq_q3', '_search_faq_a3']].map(([q, a]) => (
            <div key={q}>
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-text)', margin: '0 0 2px' }}>{t(q)}</p>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--c-text-secondary)', margin: 0 }}>{t(a)}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}