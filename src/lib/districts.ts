export interface DistrictGroup {
  group: string
  children: string[]
}

export const DISTRICT_GROUPS: DistrictGroup[] = [
  { group: 'Praha 1',  children: ['Hradčany', 'Josefov', 'Malá Strana', 'Nové Město', 'Staré Město', 'Vyšehrad'] },
  { group: 'Praha 2',  children: ['Nusle', 'Vinohrady', 'Vyšehrad'] },
  { group: 'Praha 3',  children: ['Jarov', 'Žižkov'] },
  { group: 'Praha 4',  children: ['Braník', 'Hodkovičky', 'Krč', 'Lhotka', 'Libuš', 'Michle', 'Modřany', 'Nusle', 'Pankrác', 'Podolí', 'Záběhlice'] },
  { group: 'Praha 5',  children: ['Barrandov', 'Hlubočepy', 'Jinonice', 'Košíře', 'Motol', 'Radlice', 'Smíchov', 'Stodůlky', 'Zbraslav', 'Zlíchov'] },
  { group: 'Praha 6',  children: ['Břevnov', 'Bubeneč', 'Dejvice', 'Hradčany', 'Ruzyně', 'Střešovice', 'Veleslavín', 'Vokovice'] },
  { group: 'Praha 7',  children: ['Bubeneč', 'Holešovice', 'Letná', 'Troja'] },
  { group: 'Praha 8',  children: ['Bohnice', 'Čimice', 'Karlín', 'Kobylisy', 'Libeň', 'Palmovka', 'Střížkov', 'Ďáblice'] },
  { group: 'Praha 9',  children: ['Hloubětín', 'Kyje', 'Letňany', 'Libeň', 'Prosek', 'Vysočany'] },
  { group: 'Praha 10', children: ['Hostivař', 'Malešice', 'Strašnice', 'Vršovice', 'Záběhlice'] },
  { group: 'Praha 11', children: ['Háje', 'Chodov', 'Křeslice', 'Libuš'] },
  { group: 'Praha 12', children: ['Komořany', 'Modřany', 'Písnice', 'Zbraslav'] },
  { group: 'Praha 13', children: ['Lužiny', 'Řepy', 'Stodůlky'] },
  { group: 'Praha 14', children: ['Černý Most', 'Hloubětín', 'Kyje'] },
  { group: 'Praha 15', children: ['Hostivař', 'Petrovice', 'Štěrboholy'] },
]

// All unique district names flat (groups + children)
export const ALL_DISTRICTS: string[] = Array.from(new Set([
  ...DISTRICT_GROUPS.map(g => g.group),
  ...DISTRICT_GROUPS.flatMap(g => g.children),
])).sort()

// Expand selected districts — if group selected, also include all children
// Used in search queries so Praha 10 matches Vršovice listings
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

// Suggest districts based on typed address
export function suggestDistricts(address: string): string[] {
  if (!address || address.length < 3) return []
  const lower = address.toLowerCase()
  const suggestions: string[] = []

  for (const g of DISTRICT_GROUPS) {
    for (const child of g.children) {
      if (lower.includes(child.toLowerCase()) && !suggestions.includes(child)) {
        suggestions.push(child)
        if (!suggestions.includes(g.group)) suggestions.push(g.group)
      }
    }
    if (lower.includes(g.group.toLowerCase()) && !suggestions.includes(g.group)) {
      suggestions.push(g.group)
    }
  }

  return suggestions.slice(0, 4)
}

// Get parent group for a child district
export function getParentGroup(district: string): string | null {
  const group = DISTRICT_GROUPS.find(g => g.children.includes(district))
  return group ? group.group : null
}