import { DISTRICT_POLYGONS } from './district_polygons'

export interface DistrictGroup {
  group: string
  children: string[]
}

// Based on official Prague administrative division (22 správní obvody)
// Source: praga-dom.com administrative breakdown + tmaps.one district mapping
export const DISTRICT_GROUPS: DistrictGroup[] = [
  { group: 'Praha 1', children: ['Josefov', 'Staré Město', 'Malá Strana', 'Hradčany'] },
  { group: 'Praha 2', children: ['Nové Město', 'Vyšehrad', 'Vinohrady'] },
  { group: 'Praha 3', children: ['Žižkov', 'Vinohrady', 'Vysočany'] },
  { group: 'Praha 4', children: ['Braník', 'Háje', 'Hodkovičky', 'Chodov', 'Kamýk', 'Komořany', 'Krč', 'Kunratice', 'Lhotka', 'Libuš', 'Michle', 'Modřany', 'Nusle', 'Písnice', 'Podolí', 'Šeberov', 'Točná', 'Záběhlice'] },
  { group: 'Praha 5', children: ['Hlubočepy', 'Jinonice', 'Košíře', 'Motol', 'Radlice', 'Smíchov', 'Stodůlky', 'Zličín'] },
  { group: 'Praha 6', children: ['Břevnov', 'Bubeneč', 'Dejvice', 'Liboc', 'Lysolaje', 'Nebušice', 'Ruzyně', 'Sedlec', 'Střešovice', 'Suchdol', 'Veleslavín', 'Vokovice'] },
  { group: 'Praha 7', children: ['Bubeneč', 'Holešovice', 'Troja'] },
  { group: 'Praha 8', children: ['Bohnice', 'Čimice', 'Karlín', 'Kobylisy', 'Libeň', 'Střížkov', 'Ďáblice'] },
  { group: 'Praha 9', children: ['Hloubětín', 'Kyje', 'Letňany', 'Prosek', 'Střížkov', 'Vysočany'] },
  { group: 'Praha 10', children: ['Hostivař', 'Malešice', 'Strašnice', 'Vršovice', 'Záběhlice'] },
  { group: 'Praha 11', children: ['Háje', 'Chodov', 'Křeslice'] },
  { group: 'Praha 12', children: ['Komořany', 'Modřany', 'Písnice', 'Kamýk'] },
  { group: 'Praha 13', children: ['Stodůlky', 'Jinonice'] },
  { group: 'Praha 14', children: ['Černý Most', 'Hloubětín', 'Kyje', 'Hostavice'] },
  { group: 'Praha 15', children: ['Hostivař', 'Petrovice', 'Štěrboholy', 'Horní Měcholupy', 'Dolní Měcholupy'] },
  { group: 'Praha 16', children: ['Radotín', 'Lipence', 'Velká Chuchle', 'Lochkov', 'Zbraslav'] },
  { group: 'Praha 17', children: ['Řepy'] },
  { group: 'Praha 18', children: ['Letňany', 'Čakovice', 'Miškovice'] },
  { group: 'Praha 19', children: ['Kbely', 'Satalice', 'Vinoř'] },
  { group: 'Praha 20', children: ['Horní Počernice'] },
  { group: 'Praha 21', children: ['Újezd nad Lesy', 'Klánovice', 'Koloděje'] },
  { group: 'Praha 22', children: ['Uhříněves', 'Pitkovice', 'Hájek', 'Benice', 'Kolovraty', 'Královice', 'Nedvězí'] },
]

// All unique district names flat (groups + children)
export const ALL_DISTRICTS: string[] = Array.from(new Set([
  ...DISTRICT_GROUPS.map(g => g.group),
  ...DISTRICT_GROUPS.flatMap(g => g.children),
])).sort()

// Expand selected districts — if a group is selected, also include all its children.
// A child (e.g. Vinohrady) can belong to multiple parents, so this stays correct
// even for shared/split quarters like Vinohrady, Nusle, Žižkov, Vysočany.
export function expandDistricts(selected: string[]): string[] {
  if (selected.length === 0) return []
  const result = new Set<string>()
  for (const sel of selected) {
    result.add(sel)
    const group = DISTRICT_GROUPS.find(g => g.group === sel)
    if (group) group.children.forEach(c => result.add(c))
  }
  return Array.from(result)
}

// Suggest districts based on typed address text.
// This is a pure substring matcher against known district names — it does NOT
// know which street belongs to which district (we lack street→district data).
// The primary district selector is the chip grid below; suggestions are a bonus.
export function suggestDistricts(address: string): string[] {
  if (!address || address.length < 3) return []
  const lower = address.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const suggestions: string[] = []

  const add = (name: string) => { if (!suggestions.includes(name)) suggestions.push(name) }

  // Match: typed text contains a known district name as substring
  for (const name of ALL_DISTRICTS) {
    if (lower.includes(name.toLowerCase())) {
      add(name)
    }
  }

  // Match: user types "Praha" → quickly show all 22 administrative districts
  if (lower.startsWith('praha')) {
    for (const g of DISTRICT_GROUPS) {
      add(g.group)
    }
  }

  return suggestions.slice(0, 6)
}

// Get all parent groups for a child district (a quarter can have multiple parents
// due to historical cadastral splits — e.g. Vinohrady belongs to Praha 2, 3, and 10)
export function getParentGroups(district: string): string[] {
  return DISTRICT_GROUPS.filter(g => g.children.includes(district)).map(g => g.group)
}

// Backward-compatible single-parent lookup (returns first match only)
export function getParentGroup(district: string): string | null {
  const groups = getParentGroups(district)
  return groups.length > 0 ? groups[0] : null
}

// ── District polygon boundaries ──
// Imported from ./district_polygons (generated from OSM Overpass API for Praha 1–15,
// hand-approximated for sub-districts)
export { DISTRICT_POLYGONS } from './district_polygons'

// Ray-casting point-in-polygon check
// polygon stores [lng, lat] vertex pairs. This function tests whether (lat, lng) falls inside.
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]  // lng=x, lat=y
    const xj = polygon[j][0], yj = polygon[j][1]
    // Does the edge straddle the horizontal line at point lat?
    if ((yi > lat) !== (yj > lat)) {
      // x-coordinate where the edge crosses the point's latitude
      const intersectX = xi + (lat - yi) * (xj - xi) / (yj - yi)
      if (lng < intersectX) inside = !inside
    }
  }
  return inside
}

// Find which district(s) contain the given point. Returns up to 2 matches (a quarter may
// overlap multiple Prague districts due to cadastral splits).
export function findDistrictsForPoint(lat: number, lng: number): string[] {
  const matches: string[] = []
  for (const [name, polygon] of Object.entries(DISTRICT_POLYGONS)) {
    if (pointInPolygon(lat, lng, polygon)) {
      matches.push(name)
      if (matches.length >= 3) break
    }
  }
  return matches
}