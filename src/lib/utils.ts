import type { TransitStatus } from './types'

export const TRANSIT_COLORS: Record<TransitStatus, string> = {
  green:  '#16a34a',
  yellow: '#ca8a04',
  red:    '#dc2626',
  grey:   '#6b7280',
}

export const TRANSIT_BORDER_CLASS: Record<TransitStatus, string> = {
  green:  'border-l-[5px] border-l-green-600',
  yellow: 'border-l-[5px] border-l-yellow-600',
  red:    'border-l-[5px] border-l-red-600',
  grey:   'border-l-[5px] border-l-gray-400',
}

export const TRANSIT_BADGE_CLASS: Record<TransitStatus, string> = {
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  grey:   'bg-gray-100 text-gray-600',
}

export const TRANSIT_LABEL: Record<TransitStatus, string> = {
  green:  '🟢 Na lince',
  yellow: '🟡 Blízko oblasti',
  red:    '🔴 Na lince, mimo oblast',
  grey:   '⚪ Mimo oblast',
}

// Metro line colors (official PID palette)
export const METRO_LINE_COLORS: Record<string, string> = {
  A: '#00a562',
  B: '#f5a623',
  C: '#e2001a',
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  '1+kk': '1+kk', '1+1': '1+1',
  '2+kk': '2+kk', '2+1': '2+1',
  '3+kk': '3+kk', '3+1': '3+1',
  '4+kk': '4+kk', '4+1': '4+1',
  'atypical': 'Atypický',
}

export function formatPrice(czk: number): string {
  return czk.toLocaleString('cs-CZ') + ' Kč/měs'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getImageUrl(path: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/listing-images/${path}`
}