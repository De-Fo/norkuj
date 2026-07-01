import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ListingSearchResult, TransitStatus } from '../lib/types'
import { lineColor } from '../lib/utils'

const COLORS: Record<TransitStatus, string> = {
  green: '#16a34a', yellow: '#ca8a04', red: '#dc2626', grey: '#9ca3af',
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const PRAGUE: [number, number] = [14.4208, 50.0880]
const PID_GEOJSON_BASE = `${SUPABASE_URL}/storage/v1/object/public/pid-data`

const FALLBACK_ROUTES: Record<string, [number, number][]> = {
  A: [[14.5293,50.0693],[14.5064,50.0739],[14.4888,50.0769],[14.4704,50.0778],[14.4594,50.0770],[14.4375,50.0753],[14.4294,50.0787],[14.4232,50.0821],[14.4165,50.0864],[14.4031,50.0882],[14.3908,50.0978],[14.3950,50.1005],[14.3766,50.1019],[14.3625,50.1031],[14.3489,50.1010],[14.3352,50.0989]],
  B: [[14.5777,50.1068],[14.5616,50.1014],[14.5464,50.0987],[14.5285,50.0948],[14.5109,50.0958],[14.4950,50.0951],[14.4789,50.0936],[14.4657,50.0935],[14.4533,50.0923],[14.4399,50.0908],[14.4294,50.0877],[14.4232,50.0821],[14.4175,50.0795],[14.4189,50.0735],[14.4034,50.0707],[14.4036,50.0648],[14.3939,50.0619],[14.3778,50.0595],[14.3618,50.0600],[14.3484,50.0594],[14.3354,50.0575],[14.3192,50.0546],[14.3040,50.0537],[14.2896,50.0539]],
  C: [[14.5204,50.1352],[14.5029,50.1253],[14.4919,50.1166],[14.4837,50.1093],[14.4704,50.1213],[14.4444,50.1013],[14.4319,50.1000],[14.4399,50.0908],[14.4351,50.0829],[14.4294,50.0787],[14.4329,50.0750],[14.4270,50.0653],[14.4324,50.0591],[14.4397,50.0481],[14.4454,50.0393],[14.4522,50.0319],[14.4629,50.0251],[14.4784,50.0186],[14.4960,50.0128]],
  '22': [[14.3156,50.0711],[14.3371,50.0737],[14.3510,50.0784],[14.3623,50.0880],[14.3722,50.0942],[14.3844,50.0996],[14.3924,50.0918],[14.3987,50.0918],[14.4006,50.0898],[14.4016,50.0943],[14.4039,50.0866],[14.4065,50.0826],[14.4073,50.0787],[14.4145,50.0819],[14.4153,50.0858],[14.4165,50.0874],[14.4179,50.0930]],
  '9':  [[14.3628,50.0810],[14.3828,50.0848],[14.4031,50.0882],[14.4165,50.0864],[14.4232,50.0821],[14.4175,50.0795],[14.4189,50.0735],[14.4329,50.0750],[14.4397,50.0481]],
  '17': [[14.4319,50.1000],[14.4165,50.0864],[14.4073,50.0787],[14.4145,50.0819],[14.4189,50.0735],[14.4270,50.0653]],
}

const geojsonCache: Record<string, GeoJSON.GeoJSON> = {}

async function fetchLineGeoJSON(line: string): Promise<GeoJSON.GeoJSON> {
  if (geojsonCache[line]) return geojsonCache[line]
  try {
    const res = await fetch(`${PID_GEOJSON_BASE}/line_${line}.geojson`)
    if (!res.ok) throw new Error('not found')
    const data = await res.json()
    geojsonCache[line] = data
    return data
  } catch {
    const coords = FALLBACK_ROUTES[line] ?? []
    const fallback: GeoJSON.GeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: { line },
        geometry: { type: 'LineString', coordinates: coords }
      }]
    }
    geojsonCache[line] = fallback
    return fallback
  }
}

// Prague district polygons - replace with real GeoJSON after uploading to pid-data bucket
// Source for accurate data: https://github.com/blaka/prague-districts-geojson
const DISTRICT_POLYGONS: Record<string, [number, number][]> = {
  'Praha 1': [[14.3912,50.0947],[14.4052,50.0947],[14.4312,50.0892],[14.4401,50.0823],[14.4298,50.0736],[14.4148,50.0703],[14.3948,50.0748],[14.3828,50.0848],[14.3912,50.0947]],
  'Praha 2': [[14.4148,50.0703],[14.4298,50.0736],[14.4540,50.0712],[14.4628,50.0617],[14.4438,50.0543],[14.4228,50.0576],[14.4088,50.0668],[14.4148,50.0703]],
  'Praha 3': [[14.4298,50.0736],[14.4401,50.0823],[14.4701,50.0858],[14.5001,50.0778],[14.4901,50.0668],[14.4628,50.0617],[14.4298,50.0736]],
  'Praha 4': [[14.4088,50.0668],[14.4228,50.0576],[14.4628,50.0617],[14.4784,50.0186],[14.4438,50.0150],[14.4088,50.0300],[14.3988,50.0500],[14.4088,50.0668]],
  'Praha 5': [[14.3388,50.0510],[14.3988,50.0500],[14.4088,50.0668],[14.3948,50.0748],[14.3828,50.0848],[14.3628,50.0810],[14.3388,50.0710],[14.3388,50.0510]],
  'Praha 6': [[14.3388,50.0710],[14.3628,50.0810],[14.3828,50.0848],[14.3912,50.0947],[14.3808,50.1147],[14.3508,50.1147],[14.3208,50.1047],[14.3208,50.0847],[14.3388,50.0710]],
  'Praha 7': [[14.4052,50.0947],[14.4352,50.0947],[14.4552,50.1047],[14.4552,50.1147],[14.4152,50.1147],[14.3808,50.1147],[14.3912,50.0947],[14.4052,50.0947]],
  'Praha 8': [[14.4352,50.0947],[14.4552,50.1047],[14.5052,50.1147],[14.5252,50.1047],[14.5052,50.0847],[14.4701,50.0858],[14.4401,50.0823],[14.4352,50.0947]],
  'Praha 9': [[14.5052,50.0847],[14.5252,50.1047],[14.5652,50.1047],[14.5652,50.0847],[14.5452,50.0747],[14.5052,50.0747],[14.5052,50.0847]],
  'Praha 10':[[14.4628,50.0617],[14.4901,50.0668],[14.5201,50.0668],[14.5201,50.0468],[14.4901,50.0368],[14.4628,50.0417],[14.4628,50.0617]],
  'Vinohrady':[[14.4298,50.0736],[14.4628,50.0617],[14.4540,50.0712],[14.4401,50.0823],[14.4298,50.0736]],
  'Žižkov':  [[14.4401,50.0823],[14.4701,50.0858],[14.4801,50.0758],[14.4628,50.0617],[14.4401,50.0823]],
  'Holešovice':[[14.4152,50.0947],[14.4552,50.1047],[14.4552,50.1147],[14.4152,50.1147],[14.4152,50.0947]],
  'Smíchov': [[14.3828,50.0648],[14.4028,50.0648],[14.4148,50.0703],[14.4088,50.0668],[14.3988,50.0500],[14.3688,50.0548],[14.3828,50.0648]],
  'Dejvice':  [[14.3508,50.0947],[14.3908,50.0978],[14.3912,50.0947],[14.3808,50.1047],[14.3508,50.1047],[14.3508,50.0947]],
  'Bubeneč':  [[14.3908,50.0978],[14.4152,50.0947],[14.4152,50.1147],[14.3808,50.1147],[14.3808,50.1047],[14.3908,50.0978]],
  'Karlín':   [[14.4401,50.0823],[14.4701,50.0858],[14.4701,50.0958],[14.4552,50.1047],[14.4352,50.0947],[14.4401,50.0823]],
  'Nusle':    [[14.4228,50.0576],[14.4628,50.0617],[14.4628,50.0417],[14.4228,50.0376],[14.4028,50.0476],[14.4228,50.0576]],
  'Vršovice': [[14.4540,50.0712],[14.4628,50.0617],[14.4828,50.0617],[14.4828,50.0717],[14.4628,50.0817],[14.4540,50.0712]],
  'Košíře':   [[14.3388,50.0510],[14.3688,50.0548],[14.3988,50.0500],[14.3988,50.0300],[14.3688,50.0200],[14.3388,50.0310],[14.3388,50.0510]],
  'Modřany':  [[14.3988,50.0300],[14.4388,50.0150],[14.4538,49.9950],[14.4088,49.9850],[14.3788,49.9950],[14.3688,50.0150],[14.3988,50.0300]],
  'Letňany':  [[14.5052,50.1147],[14.5452,50.1347],[14.5652,50.1247],[14.5652,50.1047],[14.5052,50.1047],[14.5052,50.1147]],
  'Chodov':   [[14.4629,50.0251],[14.4960,50.0128],[14.5060,49.9928],[14.4660,49.9828],[14.4429,49.9928],[14.4429,50.0151],[14.4629,50.0251]],
  'Prosek':   [[14.4837,50.1093],[14.5237,50.1293],[14.5437,50.1193],[14.5237,50.0993],[14.4837,50.0993],[14.4837,50.1093]],
  'Braník':   [[14.3988,50.0300],[14.4388,50.0300],[14.4388,50.0100],[14.3988,50.0100],[14.3788,50.0200],[14.3988,50.0300]],
  'Řepy':     [[14.2896,50.0539],[14.3296,50.0739],[14.3496,50.0639],[14.3296,50.0439],[14.2896,50.0339],[14.2896,50.0539]],
  'Zbraslav': [[14.3788,49.9650],[14.4188,49.9650],[14.4388,49.9450],[14.3988,49.9250],[14.3588,49.9350],[14.3588,49.9550],[14.3788,49.9650]],
  'Střešovice':[[14.3508,50.0947],[14.3908,50.0978],[14.3908,50.0878],[14.3708,50.0778],[14.3508,50.0878],[14.3508,50.0947]],
}

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
  const activeLayerIds = useRef<string[]>([])

  const removeOverlays = useCallback((map: maplibregl.Map) => {
    activeLayerIds.current.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    })
    activeLayerIds.current = []
  }, [])

  const addOverlays = useCallback(async (map: maplibregl.Map, lines: string[], districts: string[]) => {
    removeOverlays(map)
    const newIds: string[] = []

    for (const line of lines) {
      const geojson = await fetchLineGeoJSON(line)
      const srcId = `line-src-${line}`
      const haloId = `line-halo-${line}`
      const layerId = `line-layer-${line}`
      const color = lineColor(line)
      if (map.getSource(srcId)) map.removeSource(srcId)
      map.addSource(srcId, { type: 'geojson', data: geojson })
      map.addLayer({ id: haloId, type: 'line', source: srcId,
        paint: { 'line-color': color, 'line-width': 10, 'line-opacity': 0.15 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({ id: layerId, type: 'line', source: srcId,
        paint: { 'line-color': color, 'line-width': 3.5, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      newIds.push(srcId, haloId, layerId)
    }

    for (const district of districts) {
      const polygon = DISTRICT_POLYGONS[district]
      if (!polygon) continue
      const srcId = `district-src-${district}`
      const fillId = `district-fill-${district}`
      const lineId = `district-line-${district}`
      if (map.getSource(srcId)) map.removeSource(srcId)
      map.addSource(srcId, { type: 'geojson', data: {
        type: 'Feature', properties: { name: district },
        geometry: { type: 'Polygon', coordinates: [polygon] }
      }})
      map.addLayer({ id: fillId, type: 'fill', source: srcId,
        paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.07 } })
      map.addLayer({ id: lineId, type: 'line', source: srcId,
        paint: { 'line-color': '#2563eb', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [3, 2] } })
      newIds.push(srcId, fillId, lineId)
    }

    activeLayerIds.current = newIds
  }, [removeOverlays])

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
    map.on('load', () => addOverlays(map, activeLines, activeDistricts))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    addOverlays(map, activeLines, activeDistricts)
  }, [activeLines, activeDistricts, addOverlays])

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
      el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${COLORS[l.transit_status]};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.22);cursor:pointer;transition:transform 0.13s;`
      el.addEventListener('click', () => onMarkerClick(l.listing_id))
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([l.lng, l.lat])
        .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false })
          .setHTML(`<div style="font-family:inherit"><div style="font-size:12px;font-weight:600">${l.title}</div><div style="font-size:11px;color:#64748b;margin-top:2px">${l.price_total_czk.toLocaleString('cs-CZ')} Kč · ${l.area_sqm} m²</div></div>`))
        .addTo(map)
      markersRef.current.set(l.listing_id, marker)
    })
  }, [listings, onMarkerClick])

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
      <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'white', border: '1px solid var(--c-border)', borderRadius: 9, padding: '8px 11px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 11, pointerEvents: 'none' }}>
        {([['#16a34a','V oblasti ≤500 m'],['#ca8a04','V oblasti >500 m'],['#dc2626','Na lince, mimo'],['#9ca3af','Mimo oblast']] as [string,string][]).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ color: 'var(--c-muted)' }}>{label}</span>
          </div>
        ))}
        {activeLines.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--c-border)' }}>
            {activeLines.map(line => (
              <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ width: 14, height: 3, borderRadius: 2, background: lineColor(line), flexShrink: 0 }} />
                <span style={{ color: 'var(--c-muted)' }}>{['A','B','C'].includes(line) ? `Metro ${line}` : `Tram ${line}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}