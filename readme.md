# Norkuj — Pronájem bez realitky

**Open-source P2P rental platform for Czech Republic.** Zero broker fees, zero agency spam.  
Find your next apartment by Metro/Tram lines, districts, or travel time by public transport.

> 🚀 **Demo:** https://norkuj.cz (coming soon)  
> 📦 **Stack:** React 19 + TypeScript + Vite + Supabase + MapLibre GL + PostGIS

---

## Features

### 🔍 Smart Search
- **Transit filter** — select Metro A/B/C or Tram lines → show only listings within 500 m of a station
- **District filter** — Praha 1–22 + sub-districts (Vinohrady, Žižkov, Holešovice…)
- **Combined mode** — 4-color status (green = near transit + in district, yellow = district only, red = transit only, grey = other)
- **Isochrone** — click anywhere on map → see how far you can reach in N minutes by public transport (5–120 min)
- **Map area filter** — listings only within the visible map bounds
- Sort by price, area, or date

### 🗺️ Interactive Map (MapLibre GL)
- Color-coded markers by transit proximity (🟢 🟡 🔴 ⚪)
- Transit line overlays (metro + tram routes with GeoJSON)
- District polygon overlays
- **Isochrone polygon** — real-time reachability overlay
- Click anywhere to start isochrone / see listing details

### 📋 Listings
- Create listings with photos (MIME/type validated, 5 MB limit, safe filenames)
- Full detail view: mini-map, gallery, owner contact, amenities
- Status workflow: draft → pending_review → published / rejected
- Auto-expire after 90 days

### 👤 User Accounts
- Register / login (email + password)
- Profile editor (name, phone, avatar)
- Favorites (save listings)
- Forgot password flow

### 🔐 Admin Panel
- Review pending listings
- Approve or reject with reason
- Role-based access (`profiles.is_admin` flag)

### 🌐 Multi-language
- English / Čeština
- Auto-detects browser language
- Manual toggle

---

## Tech Stack

| Layer      | Technology                                                    |
| ---------- | ------------------------------------------------------------- |
| Frontend   | React 19, TypeScript, Vite 8.1 (oxc), Tailwind CSS v4        |
| Map        | MapLibre GL JS 5.24 + MapTiler streets-v2 tiles               |
| Database   | Supabase (PostgreSQL 15 + PostGIS 3 + Auth + Storage)        |
| Hosting    | Cloudflare Pages (`npm run build` → deploy)                   |
| Icons      | Lucide React                                                  |
| i18n       | Custom `useLang` hook (CS/EN)                                 |

---

## Quick Start

### Prerequisites
- Node.js 22+
- Supabase project (free tier works)
- MapTiler API key (free tier)

### Setup

```bash
# 1. Clone & install
git clone https://github.com/yourusername/norkuj
cd norkuj
npm install

# 2. Environment variables
cp .env.example .env.local
# Fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPTILER_KEY

# 3. Database
# Go to Supabase Dashboard → SQL Editor
# Run supabase/schema.sql (creates tables, RLS, functions, seeds data)

# 4. Supabase Storage
# Dashboard → Storage → New bucket → name: "listing-images" → Public: ON
# Dashboard → Storage → New bucket → name: "pid-data" → Public: ON

# 5. Run dev server
npm run dev
```

### Production Build

```bash
npm run build       # tsc -b && vite build
npm run preview     # Preview production build locally
```

---

## Database

### Tables (public schema)

| Table                  | RLS | Purpose                                  |
| ---------------------- | --- | ---------------------------------------- |
| `profiles`             | ✅  | User profiles (linked to auth.users)     |
| `listings`             | ✅  | Rental listings with PostGIS location    |
| `pid_stations`         | ✅  | 15,703 Prague transit stations           |
| `transit_travel_times` | ✅  | 32,753 transit edges (travel times)      |
| `favorites`            | ✅  | User favorites                           |

### Key Functions

- `calculate_isochrone_polygon(p_lat, p_lng, p_minutes, p_num_bins=72)` → JSONB polygon
  - BFS on transit graph + star-shape polygon with radial smoothing
  - Returns 72 vertices guaranteed non-self-intersecting
- `search_listings_with_transit(p_line, ...)` → listings with distance to nearest station
- `get_published_listings_with_coords()` → all published listings with coordinates

### RLS Security

All user-data tables have Row Level Security enabled.  
Public (anon) role has SELECT-only access to published data.  
Admin access is controlled via `profiles.is_admin` boolean flag.  
No `service_role` key is used in client code.

---

## Isochrone Engine

The isochrone system is unique — instead of drawing walking-distance circles, it computes **real transit reachability**:

1. **BFS on transit graph**: walks 350 m from the clicked point to nearest stops, then traverses all connected transit edges within the time budget
2. **Star-shape polygon**: divides the circle into 72 angular bins (5° each), keeps the farthest reachable stop per bin
3. **Radial smoothing**: 3-bin moving average prevents extreme spikes
4. **No self-intersections**: strict angle monotonicity guarantee

Performance: ~34 ms (10 min) to ~2.5 s (60 min). Loading state is shown during computation.

---

## Environment Variables

```
VITE_SUPABASE_URL          # https://[project].supabase.co
VITE_SUPABASE_ANON_KEY     # Anon/publishable key (NOT service_role)
VITE_MAPTILER_KEY          # MapTiler API key
VITE_ADMIN_UIDS            # Comma-separated admin UIDs (legacy fallback)
VITE_GOLEMIO_API_KEY       # Golemio API key (optional, for future realtime features)
```

---

## Project Structure

```
src/
├── App.tsx                  # Root component + router
├── components/
│   ├── FilterPanel.tsx      # Search filters UI
│   ├── Footer.tsx           # Site footer
│   ├── ListingCard.tsx      # Listing preview card
│   ├── Map.tsx              # MapLibre GL map wrapper
│   └── SearchFilters.tsx    # Search + Sort toolbar
├── lib/
│   ├── district_polygons.ts # Prague district boundary coordinates
│   ├── districts.ts         # District groups + point-in-polygon
│   ├── isochrone.ts         # Client-side point-in-polygon
│   ├── lang.tsx             # i18n hook (CS/EN)
│   ├── supabase.ts          # Supabase client setup
│   ├── types.ts             # TypeScript types
│   ├── utils.ts             # Utilities (formatting, image URLs)
│   └── validation.ts        # Form validation rules
└── pages/
    ├── AdminPanel.tsx       # Admin approval dashboard
    ├── Auth.tsx             # Login/Register/Forgot password
    ├── CreateListing.tsx    # New listing form
    ├── ListingDetail.tsx    # Full listing view
    ├── MyListings.tsx       # User's own listings
    ├── Profile.tsx          # User profile editor
    └── Search.tsx           # Main search + map page
```

---

## Contributing

PRs welcome! Open an issue first for bigger features.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## License

MIT © [De-Fo](https://github.com/De-Fo)

---

## Acknowledgments

- **PID (Pražská integrovaná doprava)** — open transit data & GTFS feeds
- **Supabase** — backend infrastructure
- **MapLibre** — open-source map rendering
- **MapTiler** — map tile hosting
- All open-source dependencies (React, Vite, PostGIS, etc.)
