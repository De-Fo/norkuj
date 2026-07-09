export type PropertyType = '1+kk' | '1+1' | '2+kk' | '2+1' | '3+kk' | '3+1' | '4+kk' | '4+1' | 'atypical' | 'pokoj'
export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rented' | 'rejected' | 'deleted'
export type TransitType = 'metro' | 'tram' | 'bus' | 'train'
export type TransitStatus = 'green' | 'yellow' | 'red' | 'grey'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  phone: string
  email: string         
  email_verified: boolean
  is_banned: boolean
  ban_reason: string | null
  created_at: string
  updated_at: string
}

export interface Listing {
  id: string
  owner_id: string
  title: string
  description: string
  property_type: PropertyType
  price_czk: number
  utilities_czk: number
  price_total_czk: number
  deposit_czk: number | null
  area_sqm: number
  floor: number | null
  total_floors: number | null
  available_from: string
  min_lease_months: number
  furnished: boolean
  pets_allowed: boolean
  parking: boolean
  balcony: boolean
  cellar: boolean
  address_street: string
  address_city: string
  address_district: string | null
  address_zip: string | null
  image_paths: string[]
  status: ListingStatus
  created_at: string
  updated_at: string
  published_at: string | null
  expires_at: string | null
  location?: any                   // PostGIS geography POINT — Supabase returns {type:"Point",coordinates:[lng,lat]}
}

export interface PidStation {
  id: number
  gtfs_stop_id: string
  name: string
  transit_type: TransitType
  lines: string[]
  is_active: boolean
}

export interface ListingSearchResult {
  listing_id: string
  title: string
  price_total_czk: number
  property_type: PropertyType
  area_sqm: number
  address_district: string | null
  available_from: string
  image_paths: string[]
  lat: number
  lng: number
  nearest_station_name: string
  nearest_station_line: string
  nearest_station_metres: number
  transit_status: TransitStatus
}

// ── Filter state ─────────────────────────────────────────────
// Multi-select where combining makes sense, single where it doesn't
export interface SearchFilters {
  transitLines: string[]          // multi: ['A', '22'] — best status wins per listing
  propertyTypes: PropertyType[]   // multi: ['2+kk', '3+kk'] — OR logic
  districts: string[]             // multi: ['Vinohrady', 'Žižkov'] — OR logic
  minPrice: number                // text input: lower bound, 0 = no limit
  maxPrice: number                // text input: upper bound, 0 = no limit
  minArea: number                 // single: lower bound, 0 = no limit
  furnished: boolean              // toggle
  petsAllowed: boolean            // toggle
  parking: boolean                // toggle
  balcony: boolean                // toggle
  filterByMapArea: boolean        // toggle — filter by visible map bounds
  sortBy: 'date' | 'price' | 'area'  // sort field
  sortDir: 'asc' | 'desc'            // sort direction
}

export const DEFAULT_FILTERS: SearchFilters = {
  transitLines: [],
  propertyTypes: [],
  districts: [],
  minPrice: 0,
  maxPrice: 0,
  minArea: 0,
  furnished: false,
  petsAllowed: false,
  parking: false,
  balcony: false,
  filterByMapArea: false,
  sortBy: 'date',
  sortDir: 'desc',
}

export const PRAGUE_DISTRICTS = [
  'Praha 1','Praha 2','Praha 3','Praha 4','Praha 5',
  'Praha 6','Praha 7','Praha 8','Praha 9','Praha 10',
  'Vinohrady','Žižkov','Holešovice','Smíchov','Dejvice',
  'Bubeneč','Nusle','Vršovice','Košíře','Karlín',
  'Letňany','Chodov','Modřany','Braník','Prosek',
  'Střešovice','Řepy','Zbraslav',
]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  'pokoj':    '🛏 Pokoj',
  '1+kk':    '1+kk',
  '1+1':     '1+1',
  '2+kk':    '2+kk',
  '2+1':     '2+1',
  '3+kk':    '3+kk',
  '3+1':     '3+1',
  '4+kk':    '4+kk',
  '4+1':     '4+1',
  'atypical':'Atypický',
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      listings: { Row: Listing; Insert: Omit<Listing, 'id' | 'price_total_czk' | 'created_at' | 'updated_at' | 'expires_at'>; Update: Partial<Listing> }
      pid_stations: { Row: PidStation; Insert: Omit<PidStation, 'id'>; Update: Partial<PidStation> }
    }
    Functions: {
      search_listings_with_transit: {
        Args: { p_line: string; p_max_price?: number; p_property_types?: string[] | null; p_districts?: string[] | null; p_bbox?: object | null }
        Returns: ListingSearchResult[]
      }
    }
  }
}