import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ListingSearchResult, TransitStatus } from '../lib/types'
import type { Feature } from 'geojson'

const COLORS: Record<TransitStatus, string> = {
  green: '#16a34a', yellow: '#ca8a04', red: '#dc2626', grey: '#9ca3af',
}

const LINE_COLORS: Record<string, string> = {
  A: '#00a562', B: '#f5a623', C: '#e2001a',
  '1':'#0070c0','2':'#0070c0','4':'#0070c0','6':'#0070c0','7':'#0070c0',
  '8':'#0070c0','9':'#0070c0','10':'#0070c0','11':'#0070c0','12':'#0070c0',
  '13':'#0070c0','14':'#0070c0','15':'#0070c0','17':'#0070c0','18':'#0070c0',
  '20':'#0070c0','22':'#0070c0','23':'#0070c0','24':'#0070c0','25':'#0070c0','26':'#0070c0',
}

const LINE_ROUTES: Record<string, GeoJSON.Feature> = {
  A: {
    type: 'Feature', properties: { line: 'A' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.5293,50.0693],[14.5064,50.0739],[14.4888,50.0769],[14.4704,50.0778],
        [14.4594,50.0770],[14.4375,50.0753],[14.4294,50.0787],[14.4232,50.0821],
        [14.4165,50.0864],[14.4031,50.0882],[14.3908,50.0978],[14.3950,50.1005],
        [14.3766,50.1019],[14.3625,50.1031],[14.3489,50.1010],[14.3352,50.0989],
      ]
    }
  },
  B: {
    type: 'Feature', properties: { line: 'B' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.5777,50.1068],[14.5616,50.1014],[14.5464,50.0987],[14.5285,50.0948],
        [14.5109,50.0958],[14.4950,50.0951],[14.4789,50.0936],[14.4657,50.0935],
        [14.4533,50.0923],[14.4399,50.0908],[14.4294,50.0877],[14.4232,50.0821],
        [14.4175,50.0795],[14.4189,50.0735],[14.4034,50.0707],[14.4036,50.0648],
        [14.3939,50.0619],[14.3778,50.0595],[14.3618,50.0600],[14.3484,50.0594],
        [14.3354,50.0575],[14.3192,50.0546],[14.3040,50.0537],[14.2896,50.0539],
      ]
    }
  },
  C: {
    type: 'Feature', properties: { line: 'C' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.5204,50.1352],[14.5029,50.1253],[14.4919,50.1166],[14.4837,50.1093],
        [14.4704,50.1213],[14.4444,50.1013],[14.4319,50.1000],[14.4399,50.0908],
        [14.4351,50.0829],[14.4294,50.0787],[14.4329,50.0750],[14.4270,50.0653],
        [14.4324,50.0591],[14.4397,50.0481],[14.4454,50.0393],[14.4522,50.0319],
        [14.4629,50.0251],[14.4784,50.0186],[14.4960,50.0128],
      ]
    }
  },
  '22': {
    type: 'Feature', properties: { line: '22' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [14.3156,50.0711],[14.3371,50.0737],[14.3510,50.0784],[14.3623,50.0880],
        [14.3722,50.0942],[14.3844,50.0996],[14.3924,50.0918],[14.3987,50.0918],
        [14.4006,50.0898],[14.4016,50.0943],[14.4039,50.0866],[14.4065,50.0826],
        [14.4073,50.0787],[14.4145,50.0819],[14.4153,50.0858],[14.4165,50.0874],
        [14.4179,50.0930],
      ]
    }
  },
}

// Prague district approximate bounding polygons (simplified)
const DISTRICTS: Record<string, GeoJSON.Feature> = {
  'Praha 1': {
    type: 'Feature', properties: { name: 'Praha 1' },
    geometry: { type: 'Polygon', coordinates: [[[14.40,50.08],[14.43,50.08],[14.44,50.09],[14.43,50.10],[14.40,50.10],[14.39,50.09],[14.40,50.08]]] }
  },
  'Praha 2': {
    type: 'Feature', properties: { name: 'Praha 2' },
    geometry: { type: 'Polygon', coordinates: [[[14.41,50.06],[14.45,50.06],[14.46,50.08],[14.44,50.09],[14.41,50.08],[14.40,50.07],[14.41,50.06]]] }
  },
  'Praha 3': {
    type: 'Feature', properties: { name: 'Praha 3' },
    geometry: { type: 'Polygon', coordinates: [[[14.44,50.07],[14.48,50.07],[14.49,50.09],[14.47,50.10],[14.44,50.09],[14.43,50.08],[14.44,50.07]]] }
  },
  'Vinohrady': {
    type: 'Feature', properties: { name: 'Vinohrady' },
    geometry: { type: 'Polygon', coordinates: [[[14.43,50.07],[14.46,50.07],[14.47,50.08],[14.45,50.09],[14.43,50.08],[14.42,50.07],[14.43,50.07]]] }
  },
  'Žižkov': {
    type: 'Feature', properties: { name: 'Žižkov' },
    geometry: { type: 'Polygon', coordinates: [[[14.44,50.08],[14.48,50.08],[14.49,50.09],[14.47,50.10],[14.44,50.09],[14.43,50.08],[14.44,50.08]]] }
  },
  'Holešovice': {
    type: 'Feature', properties: { name: 'Holešovice' },
    geometry: { type: 'Polygon', coordinates: [[[14.42,50.09],[14.46,50.09],[14.47,50.11],[14.44,50.11],[14.42,50.10],[14.41,50.09],[14.42,50.09]]] }
  },
  'Smíchov': {
    type: 'Feature', properties: { name: 'Smíchov' },
    geometry: { type: 'Polygon', coordinates: [[[14.39,50.06],[14.42,50.06],[14.43,50.08],[14.41,50.08],[14.39,50.07],[14.38,50.06],[14.39,50.06]]] }
  },
  'Dejvice': {
    type: 'Feature', properties: { name: 'Dejvice' },
    geometry: { type: 'Polygon', coordinates: [[[14.37,50.09],[14.41,50.09],[14.42,50.11],[14.40,50.11],[14.37,50.10],[14.36,50.09],[14.37,50.09]]] }
  },
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const PRAGUE: [number, number] = [14.4208, 50.0880]

interface Props {
  listings: ListingSearchResult[]
  highlightedId: string | null
  onMarkerClick: (id: string) => void
  onBoundsChange: (bbox: { west: number; south: number; east: number; north: number }) => void
  activeLines: string[]
  activeDistricts: string[]
}

export function Map({ listings, highlightedId, onMarkerClick, onBoundsChange, activeLines, activeDistricts }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map())
  const prevLinesRef = useRef<string[]>([])
  const prevDistrictsRef = useRef<string[]>([])

  const updateOverlays = useCallback((map: maplibregl.Map, lines: string[], districts: string[]) => {
    // Remove old line layers
    prevLinesRef.current.forEach(line => {
      const id = `line-${line}`
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    })
    // Remove old district layers
    prevDistrictsRef.current.forEach(d => {
      const id = `district-${d.replace(/\s/g, '-')}`
      if (map.getLayer(id + '-fill')) map.removeLayer(id + '-fill')
      if (map.getLayer(id + '-border')) map.removeLayer(id + '-border')
      if (map.getLayer(id + '-label')) map.removeLayer(id + '-label')
      if (map.getSource(id)) map.removeSource(id)
    })

    // Add active line routes
    lines.forEach(line => {
      const route = LINE_ROUTES[line]
      if (!route) return
      const id = `line-${line}`
      const color = LINE_COLORS[line] ?? '#2563eb'
      map.addSource(id, { type: 'geojson', data: route })
      map.addLayer({
        id, type: 'line', source: id,
        paint: {
          'line-color': color,
          'line-width': 4,
          'line-opacity': 0.85,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    })

    // Add active district overlays
    districts.forEach(d => {
      const feature = DISTRICTS[d]
      if (!feature) return
      const id = `district-${d.replace(/\s/g, '-')}`
      map.addSource(id, { type: 'geojson', data: feature })
      map.addLayer({
        id: id + '-fill', type: 'fill', source: id,
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.06 },
      })
      map.addLayer({
        id: id + '-border', type: 'line', source: id,
        paint: { 'line-color': '#2563eb', 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [4, 2] },
      })
    })

    prevLinesRef.current = lines
    prevDistrictsRef.current = districts
  }, [])

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: PRAGUE, zoom: 12.5,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('moveend', () => {
      const b = map.getBounds()
      onBoundsChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })
    })
    map.on('load', () => {
      updateOverlays(map, activeLines, activeDistricts)
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  // Update overlays when lines/districts change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    updateOverlays(map, activeLines, activeDistricts)
  }, [activeLines, activeDistricts, updateOverlays])

  // Sync markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const ids = new Set(listings.map(l => l.listing_id))
    markersRef.current.forEach((m, id) => {
      if (!ids.has(id)) { m.remove(); markersRef.current.delete(id) }
    })
    listings.forEach(l => {
      if (!l.lat || !l.lng || markersRef.current.has(l.listing_id)) return
      const el = document.createElement('div')
      el.style.cssText = `
        width:28px;height:28px;border-radius:50%;
        background:${COLORS[l.transit_status]};
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.22);
        cursor:pointer;
        transition:transform 0.13s;
      `
      el.addEventListener('click', () => onMarkerClick(l.listing_id))
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([l.lng, l.lat])
        .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false })
          .setHTML(`
            <div style="font-family:inherit">
              <div style="font-size:12px;font-weight:600">${l.title}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">
                ${l.price_total_czk.toLocaleString('cs-CZ')} Kč · ${l.area_sqm} m²
              </div>
            </div>
          `))
        .addTo(map)
      markersRef.current.set(l.listing_id, marker)
    })
  }, [listings, onMarkerClick])

  // Highlight
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement()
      el.style.transform = id === highlightedId ? 'scale(1.25)' : 'scale(1)'
      el.style.zIndex = id === highlightedId ? '10' : '1'
    })
  }, [highlightedId])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'white', border: '1px solid var(--c-border)',
        borderRadius: 9, padding: '8px 11px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 11,
        pointerEvents: 'none',
      }}>
        {([
          ['#16a34a','V oblasti ≤500 m'],
          ['#ca8a04','V oblasti >500 m'],
          ['#dc2626','Na lince, mimo'],
          ['#9ca3af','Mimo oblast'],
        ] as [string,string][]).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--c-muted)' }}>{label}</span>
          </div>
        ))}
        {activeLines.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--c-border)' }}>
            {activeLines.map(line => (
              <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: LINE_COLORS[line] ?? '#2563eb', flexShrink: 0 }} />
                <span style={{ color: 'var(--c-muted)' }}>
                  {['A','B','C'].includes(line) ? `Metro ${line}` : `Tram ${line}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}