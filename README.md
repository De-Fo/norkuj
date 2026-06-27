# Norkuj

**Pronájem bez realitky.** Open-source P2P rental platform for Czech Republic.

Zero broker fees, zero agency spam. Filter by Metro/Tram lines, not just districts.

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (PostgreSQL + PostGIS + Auth + Storage)
- MapLibre GL JS + MapTiler
- Cloudflare Pages

## Local setup

```bash
# 1. Clone & install
git clone https://github.com/yourusername/norkuj
cd norkuj
npm install

# 2. Environment
cp .env.example .env.local
# Fill in your Supabase anon key and MapTiler key in .env.local

# 3. Database
# Go to Supabase Dashboard → SQL Editor
# Run the contents of supabase/schema.sql

# 4. Supabase Storage
# Dashboard → Storage → New bucket → name: "listing-images" → Public: ON

# 5. Run
npm run dev
```

## Contributing

PRs welcome. Open an issue first for bigger features.

## License

MIT
