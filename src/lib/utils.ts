import type { TransitStatus } from './types'

export const TRANSIT_COLORS: Record<TransitStatus, string> = {
  green:  '#16a34a',
  yellow: '#ca8a04',
  red:    '#dc2626',
  grey:   '#9ca3af',
}

export const LINE_COLORS: Record<string, string> = {
  A: '#00a562', B: '#f5a623', C: '#e2001a', D: '#2563eb',
}

export const TRAM_COLOR = '#8B4513'

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

/**
 * Convert a HEIC/HEIF file to JPEG using heic2any.
 * Returns the original file unchanged if it's not HEIC/HEIF.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  const isHeic =
    /\.(heic|heif)$/i.test(file.name) ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.type === 'image/heic-sequence' ||
    file.type === 'image/heif-sequence'
  if (!isHeic) return file

  const heic2any = (await import('heic2any')).default
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
  const resultBlob = Array.isArray(blob) ? blob[0] : blob
  return new File(
    [resultBlob],
    file.name.replace(/\.(heic|heif)$/i, '.jpg'),
    { type: 'image/jpeg' },
  )
}

/**
 * Compress an image file client-side before upload.
 * Resizes to max 1920px on the longest side, JPEG quality 0.8.
 */
export function compressImage(file: File, maxDimension = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    // Skip non-image files or already-small images (no compression needed for <1MB)
    if (!file.type.startsWith('image/') || file.size < 1_000_000) {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width <= maxDimension && height <= maxDimension && file.size < 5_000_000) {
        resolve(file)
        return
      }
      // Scale down
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
        resolve(compressed)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}

export function activeFilterCount(filters: import('./types').SearchFilters): number {
  return (
    filters.transitLines.length +
    filters.propertyTypes.length +
    filters.districts.length +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.minArea ? 1 : 0) +
    (filters.furnished ? 1 : 0) +
    (filters.petsAllowed ? 1 : 0) +
    (filters.parking ? 1 : 0) +
    (filters.balcony ? 1 : 0) +
    (filters.filterByMapArea ? 1 : 0)
  )
}