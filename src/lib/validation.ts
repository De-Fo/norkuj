export interface ValidationError {
  field: string
  message: string
}

export interface FormData {
  title: string
  description: string
  property_type: string
  price_czk: string
  utilities_czk: string
  deposit_czk: string
  area_sqm: string
  floor: string
  available_from: string
  min_lease_months: string
  furnished: boolean
  pets_allowed: boolean
  parking: boolean
  balcony: boolean
  cellar: boolean
  address_street: string
  address_district: string
  lat: number | null
  lng: number | null
  images: File[]
}

export function validateStep(step: number, form: FormData): ValidationError[] {
  const errors: ValidationError[] = []

  if (step === 0) {
    const title = form.title.trim()
    const desc = form.description.trim()

    if (title.length < 5)
      errors.push({ field: 'title', message: 'Název musí mít alespoň 5 znaků' })
    if (title.length > 120)
      errors.push({ field: 'title', message: 'Název může mít nejvýše 120 znaků' })
    if (desc.length < 20)
      errors.push({ field: 'description', message: `Popis musí mít alespoň 20 znaků (teď: ${desc.length})` })
    if (desc.length > 5000)
      errors.push({ field: 'description', message: 'Popis může mít nejvýše 5000 znaků' })
    if (!form.property_type)
      errors.push({ field: 'property_type', message: 'Vyber typ nemovitosti' })
    if (!form.area_sqm || parseInt(form.area_sqm) < 5)
      errors.push({ field: 'area_sqm', message: 'Zadej plochu (min. 5 m²)' })
    if (!form.available_from)
      errors.push({ field: 'available_from', message: 'Zadej datum dostupnosti' })
  }

  if (step === 1) {
    if (!form.price_czk || parseInt(form.price_czk) < 1000)
      errors.push({ field: 'price_czk', message: 'Zadej nájemné (min. 1 000 Kč)' })
    if (parseInt(form.price_czk) > 500000)
      errors.push({ field: 'price_czk', message: 'Nájemné vypadá příliš vysoké' })
  }

  if (step === 2) {
    if (form.address_street.trim().length < 3)
      errors.push({ field: 'address_street', message: 'Zadej ulici a číslo' })
    if (!form.address_district)
      errors.push({ field: 'address_district', message: 'Vyber část Prahy' })
    if (!form.lat || !form.lng)
      errors.push({ field: 'location', message: 'Klikni na mapu pro označení přesné polohy' })
  }

  return errors
}

export function mapServerError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Neznámá chyba'
  const msg = error.message ?? ''

  if (msg.includes('Bucket not found'))
    return 'Úložiště fotografií není dostupné. Kontaktuj správce.'
  if (msg.includes('row-level security') && msg.includes('storage'))
    return 'Nemáš oprávnění nahrávat fotografie. Zkus se odhlásit a znovu přihlásit.'
  if (msg.includes('foreign key') && msg.includes('owner_id'))
    return 'Tvůj profil nebyl nalezen. Odhlás se a přihlas znovu — profil se vytvoří automaticky.'
  if (msg.includes('listings_description_check'))
    return 'Popis je příliš krátký (min. 20 znaků) nebo dlouhý (max. 5000 znaků).'
  if (msg.includes('listings_title_check'))
    return 'Název je příliš krátký (min. 5 znaků) nebo dlouhý (max. 120 znaků).'
  if (msg.includes('listings_price_czk_check'))
    return 'Zadej platnou výši nájemného (min. 1 Kč).'
  if (msg.includes('listings_area_sqm_check'))
    return 'Plocha musí být mezi 5 a 1000 m².'
  if (msg.includes('row-level security'))
    return 'Nejsi přihlášen nebo nemáš oprávnění. Zkus se znovu přihlásit.'
  if (msg.includes('duplicate') || (error.code ?? '') === '23505')
    return 'Tento inzerát již existuje.'
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Chyba připojení. Zkontroluj internet a zkus znovu.'
  if (msg.includes('JWT') || msg.includes('token'))
    return 'Přihlášení vypršelo. Přihlas se znovu.'

  return `Něco se pokazilo: ${msg}`
}