import type { TransitStatus } from './types'

export const TRANSIT_COLORS: Record<TransitStatus, string> = {
  green:  '#16a34a',
  yellow: '#ca8a04',
  red:    '#dc2626',
  grey:   '#9ca3af',
}

export const LINE_COLORS: Record<string, string> = {
  A: '#00a562', B: '#f5a623', C: '#e2001a',
}

export const TRAM_COLOR = '#2563eb'

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? TRAM_COLOR
}

export function formatPrice(czk: number): string {
  return czk.toLocaleString('cs-CZ') + ' Kč/měs'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getImageUrl(path: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/listing-images/${path}`
}

export function activeFilterCount(filters: import('./types').SearchFilters): number {
  return (
    filters.transitLines.length +
    filters.propertyTypes.length +
    filters.districts.length +
    (filters.maxPrice ? 1 : 0) +
    (filters.minArea ? 1 : 0) +
    (filters.furnished ? 1 : 0) +
    (filters.petsAllowed ? 1 : 0) +
    (filters.parking ? 1 : 0) +
    (filters.balcony ? 1 : 0)
  )
}