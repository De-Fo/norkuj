export type PropertyType = '1+kk' | '1+1' | '2+kk' | '2+1' | '3+kk' | '3+1' | '4+kk' | '4+1' | 'atypical'
export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'rented' | 'rejected' | 'deleted'
export type TransitType = 'metro' | 'tram' | 'bus' | 'train'
export type TransitStatus = 'green' | 'yellow' | 'red' | 'grey'

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  phone: string
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

// Multi-line: array of selected lines
export interface SearchFilters {
  transitLines: string[]       // e.g. ['A', '22'] — multiple lines
  maxPrice: number
  propertyType: PropertyType | null
  minArea: number
  furnished: boolean | null
  petsAllowed: boolean | null
  parking: boolean | null
}

export const DEFAULT_FILTERS: SearchFilters = {
  transitLines: [],
  maxPrice: 0,
  propertyType: null,
  minArea: 0,
  furnished: null,
  petsAllowed: null,
  parking: null,
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
        Args: { p_line: string; p_max_price?: number; p_property_type?: string | null; p_bbox?: object | null }
        Returns: ListingSearchResult[]
      }
    }
  }
}