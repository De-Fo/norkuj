import type { TransitStatus } from './types'

export const TRANSIT_COLORS: Record<TransitStatus, string> = {
  green:  '#16a34a',
  yellow: '#ca8a04',
  red:    '#dc2626',
  grey:   '#9ca3af',
}

export const METRO_LINE_COLORS: Record<string, string> = {
  A: '#00a562',
  B: '#f5a623',
  C: '#e2001a',
}

// 👇 ADD THIS MAP (Adjust the left keys to match your exact PropertyType values from types.ts)
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  '1kk': '1+kk',
  '1plus1': '1+1',
  '2kk': '2+kk',
  '2plus1': '2+1',
  '3kk': '3+kk',
  '3plus1': '3+1',
  '4kk': '4+kk',
  'house': 'Dům',
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

export function isMobile(): boolean {
  return window.innerWidth < 768
}