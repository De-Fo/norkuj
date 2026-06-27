import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ListingSearchResult } from '../lib/types'
import { TRANSIT_COLORS } from '../lib/utils'

interface MapProps {
  listings: ListingSearchResult[]
  highlightedId: string | null
  onMarkerClick: (id: string) => void
  onBoundsChange: (bbox: { west: number; south: number; east: number; north: number }) => void
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const PRAGUE_CENTER: [number, number] = [14.4208, 50.0880]

export function Map({ listings, highlightedId, onMarkerClick, onBoundsChange }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: PRAGUE_CENTER,
      zoom: 12,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('moveend', () => {
      const b = map.getBounds()
      onBoundsChange({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      })
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers when listings change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const currentIds = new Set(listings.map(l => l.listing_id))

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    })

    // Add / update markers
    listings.forEach(listing => {
      if (markersRef.current.has(listing.listing_id)) return

      const el = document.createElement('div')
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${TRANSIT_COLORS[listing.transit_status]};
        border: 2.5px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.15s;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; color: white; font-weight: bold;
      `
      el.addEventListener('click', () => onMarkerClick(listing.listing_id))
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([listing.lng, listing.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(`
            <div style="font-size:13px;font-weight:600">${listing.title}</div>
            <div style="font-size:12px;color:#6b7280">${listing.price_total_czk.toLocaleString('cs-CZ')} Kč/měs</div>
          `)
        )
        .addTo(map)

      markersRef.current.set(listing.listing_id, marker)
    })
  }, [listings, onMarkerClick])

  // Highlight effect
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement()
      el.style.transform = id === highlightedId ? 'scale(1.35)' : 'scale(1)'
      el.style.zIndex = id === highlightedId ? '10' : '1'
    })
  }, [highlightedId])

  return <div ref={containerRef} className="w-full h-full" />
}