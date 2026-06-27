-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 60),
  avatar_url      TEXT,
  phone           TEXT NOT NULL CHECK (phone ~ '^\+?[0-9 \-]{9,20}$'),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles viewable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. PID STATIONS
CREATE TYPE public.transit_type AS ENUM ('metro', 'tram', 'bus', 'train');

CREATE TABLE public.pid_stations (
  id            SERIAL PRIMARY KEY,
  gtfs_stop_id  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  transit_type  public.transit_type NOT NULL,
  lines         TEXT[] NOT NULL DEFAULT '{}',
  location      GEOGRAPHY(POINT, 4326) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_pid_stations_location ON public.pid_stations USING GIST (location);
CREATE INDEX idx_pid_stations_lines ON public.pid_stations USING GIN (lines);

-- 3. LISTINGS
CREATE TYPE public.listing_status AS ENUM ('draft','pending_review','published','rented','rejected','deleted');
CREATE TYPE public.property_type AS ENUM ('1+kk','1+1','2+kk','2+1','3+kk','3+1','4+kk','4+1','atypical');

CREATE TABLE public.listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 50 AND 5000),
  property_type     public.property_type NOT NULL,
  price_czk         INTEGER NOT NULL CHECK (price_czk > 0),
  utilities_czk     INTEGER NOT NULL DEFAULT 0,
  price_total_czk   INTEGER GENERATED ALWAYS AS (price_czk + utilities_czk) STORED,
  deposit_czk       INTEGER,
  area_sqm          SMALLINT NOT NULL CHECK (area_sqm BETWEEN 10 AND 1000),
  floor             SMALLINT,
  total_floors      SMALLINT,
  available_from    DATE NOT NULL,
  min_lease_months  SMALLINT NOT NULL DEFAULT 12,
  furnished         BOOLEAN NOT NULL DEFAULT FALSE,
  pets_allowed      BOOLEAN NOT NULL DEFAULT FALSE,
  parking           BOOLEAN NOT NULL DEFAULT FALSE,
  balcony           BOOLEAN NOT NULL DEFAULT FALSE,
  cellar            BOOLEAN NOT NULL DEFAULT FALSE,
  address_street    TEXT NOT NULL,
  address_city      TEXT NOT NULL DEFAULT 'Praha',
  address_district  TEXT,
  address_zip       TEXT,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  image_paths       TEXT[] NOT NULL DEFAULT '{}',
  status            public.listing_status NOT NULL DEFAULT 'pending_review',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ GENERATED ALWAYS AS (published_at + INTERVAL '90 days') STORED
);

CREATE TRIGGER trg_listings_updated_at
  BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.set_published_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_listings_published_at
  BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.set_published_at();

CREATE INDEX idx_listings_location ON public.listings USING GIST (location);
CREATE INDEX idx_listings_status ON public.listings (status);
CREATE INDEX idx_listings_price ON public.listings (price_total_czk) WHERE status = 'published';
CREATE INDEX idx_listings_owner ON public.listings (owner_id);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published listings visible" ON public.listings FOR SELECT
  USING (status = 'published' AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "Owners see own listings" ON public.listings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update draft/rejected" ON public.listings FOR UPDATE
  USING (auth.uid() = owner_id AND status IN ('draft', 'rejected'));

-- 4. PROXIMITY SEARCH FUNCTION
CREATE OR REPLACE FUNCTION public.search_listings_with_transit(
  p_line          TEXT,
  p_max_price     INTEGER DEFAULT 0,
  p_property_type TEXT DEFAULT NULL,
  p_bbox          JSONB DEFAULT NULL
)
RETURNS TABLE (
  listing_id              UUID,
  title                   TEXT,
  price_total_czk         INTEGER,
  property_type           public.property_type,
  area_sqm                SMALLINT,
  address_district        TEXT,
  available_from          DATE,
  image_paths             TEXT[],
  lat                     FLOAT,
  lng                     FLOAT,
  nearest_station_name    TEXT,
  nearest_station_line    TEXT,
  nearest_station_metres  INTEGER,
  transit_status          TEXT
)
LANGUAGE sql STABLE AS $$
  WITH nearest AS (
    SELECT
      l.id AS listing_id,
      s.name AS station_name,
      p_line AS line,
      ST_Distance(l.location, s.location)::INTEGER AS metres
    FROM public.listings l
    CROSS JOIN LATERAL (
      SELECT s2.name, s2.location
      FROM public.pid_stations s2
      WHERE p_line = ANY(s2.lines) AND s2.is_active
      ORDER BY l.location <-> s2.location
      LIMIT 1
    ) s
    WHERE l.status = 'published'
      AND (l.expires_at IS NULL OR l.expires_at > NOW())
      AND (p_max_price = 0 OR l.price_total_czk <= p_max_price)
      AND (p_property_type IS NULL OR l.property_type = p_property_type::public.property_type)
  ),
  in_bbox AS (
    SELECT l.id AS listing_id
    FROM public.listings l
    WHERE p_bbox IS NOT NULL
      AND ST_Within(
            l.location::geometry,
            ST_MakeEnvelope(
              (p_bbox->>'west')::FLOAT, (p_bbox->>'south')::FLOAT,
              (p_bbox->>'east')::FLOAT, (p_bbox->>'north')::FLOAT, 4326
            )
          )
  )
  SELECT
    l.id, l.title, l.price_total_czk, l.property_type, l.area_sqm,
    l.address_district, l.available_from, l.image_paths,
    ST_Y(l.location::geometry) AS lat,
    ST_X(l.location::geometry) AS lng,
    n.station_name, n.line, n.metres,
    CASE
      WHEN (p_bbox IS NULL OR ib.listing_id IS NOT NULL) AND n.metres <= 500 THEN 'green'
      WHEN (p_bbox IS NULL OR ib.listing_id IS NOT NULL) AND n.metres >  500 THEN 'yellow'
      WHEN ib.listing_id IS NULL AND n.metres <= 500                         THEN 'red'
      ELSE 'grey'
    END AS transit_status
  FROM public.listings l
  JOIN nearest n ON n.listing_id = l.id
  LEFT JOIN in_bbox ib ON ib.listing_id = l.id
  ORDER BY
    CASE
      WHEN (p_bbox IS NULL OR ib.listing_id IS NOT NULL) AND n.metres <= 500 THEN 1
      WHEN (p_bbox IS NULL OR ib.listing_id IS NOT NULL) AND n.metres >  500 THEN 2
      WHEN ib.listing_id IS NULL AND n.metres <= 500                         THEN 3
      ELSE 4
    END,
    l.price_total_czk ASC;
$$;

-- 5. PID STATION SEED DATA (Metro A/B/C + key tram lines)
INSERT INTO public.pid_stations (gtfs_stop_id, name, transit_type, lines, location) VALUES
-- Metro A
('U118Z1P', 'Depo Hostivař',     'metro', ARRAY['A'], ST_GeogFromText('POINT(14.5293 50.0693)')),
('U119Z1P', 'Skalka',            'metro', ARRAY['A'], ST_GeogFromText('POINT(14.5064 50.0739)')),
('U120Z1P', 'Strašnická',        'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4888 50.0769)')),
('U121Z1P', 'Želivského',        'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4704 50.0778)')),
('U122Z1P', 'Flora',             'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4594 50.0770)')),
('U123Z1P', 'Náměstí Míru',      'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4375 50.0753)')),
('U118Z2P', 'Muzeum',            'metro', ARRAY['A','C'], ST_GeogFromText('POINT(14.4294 50.0787)')),
('U124Z1P', 'Můstek',            'metro', ARRAY['A','B'], ST_GeogFromText('POINT(14.4232 50.0821)')),
('U125Z1P', 'Staroměstská',      'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4165 50.0864)')),
('U126Z1P', 'Malostranská',      'metro', ARRAY['A'], ST_GeogFromText('POINT(14.4031 50.0882)')),
('U127Z1P', 'Hradčanská',        'metro', ARRAY['A'], ST_GeogFromText('POINT(14.3908 50.0978)')),
('U128Z1P', 'Dejvická',          'metro', ARRAY['A'], ST_GeogFromText('POINT(14.3950 50.1005)')),
('U129Z1P', 'Bořislavka',        'metro', ARRAY['A'], ST_GeogFromText('POINT(14.3766 50.1019)')),
('U130Z1P', 'Nádraží Veleslavín','metro', ARRAY['A'], ST_GeogFromText('POINT(14.3625 50.1031)')),
('U131Z1P', 'Petřiny',           'metro', ARRAY['A'], ST_GeogFromText('POINT(14.3489 50.1010)')),
('U132Z1P', 'Nemocnice Motol',   'metro', ARRAY['A'], ST_GeogFromText('POINT(14.3352 50.0989)')),
-- Metro B
('U201Z1P', 'Černý Most',        'metro', ARRAY['B'], ST_GeogFromText('POINT(14.5777 50.1068)')),
('U202Z1P', 'Rajská zahrada',    'metro', ARRAY['B'], ST_GeogFromText('POINT(14.5616 50.1014)')),
('U203Z1P', 'Hloubětín',         'metro', ARRAY['B'], ST_GeogFromText('POINT(14.5464 50.0987)')),
('U204Z1P', 'Kolbenova',         'metro', ARRAY['B'], ST_GeogFromText('POINT(14.5285 50.0948)')),
('U205Z1P', 'Vysočanská',        'metro', ARRAY['B'], ST_GeogFromText('POINT(14.5109 50.0958)')),
('U206Z1P', 'Českomoravská',     'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4950 50.0951)')),
('U207Z1P', 'Palmovka',          'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4789 50.0936)')),
('U208Z1P', 'Invalidovna',       'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4657 50.0935)')),
('U209Z1P', 'Křižíkova',         'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4533 50.0923)')),
('U210Z1P', 'Florenc',           'metro', ARRAY['B','C'], ST_GeogFromText('POINT(14.4399 50.0908)')),
('U211Z1P', 'Náměstí Republiky', 'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4294 50.0877)')),
('U212Z1P', 'Můstek',            'metro', ARRAY['A','B'], ST_GeogFromText('POINT(14.4232 50.0821)')),
('U213Z1P', 'Národní třída',     'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4175 50.0795)')),
('U214Z1P', 'Karlovo náměstí',   'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4189 50.0735)')),
('U215Z1P', 'Anděl',             'metro', ARRAY['B'], ST_GeogFromText('POINT(14.4034 50.0707)')),
('U216Z1P', 'Smíchovské nádraží','metro', ARRAY['B'], ST_GeogFromText('POINT(14.4036 50.0648)')),
('U217Z1P', 'Radlická',          'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3939 50.0619)')),
('U218Z1P', 'Jinonice',          'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3778 50.0595)')),
('U219Z1P', 'Nové Butovice',     'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3618 50.0600)')),
('U220Z1P', 'Hůrka',             'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3484 50.0594)')),
('U221Z1P', 'Luka',              'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3354 50.0575)')),
('U222Z1P', 'Lužiny',            'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3192 50.0546)')),
('U223Z1P', 'Stodůlky',          'metro', ARRAY['B'], ST_GeogFromText('POINT(14.3040 50.0537)')),
('U224Z1P', 'Zličín',            'metro', ARRAY['B'], ST_GeogFromText('POINT(14.2896 50.0539)')),
-- Metro C
('U301Z1P', 'Letňany',           'metro', ARRAY['C'], ST_GeogFromText('POINT(14.5204 50.1352)')),
('U302Z1P', 'Prosek',            'metro', ARRAY['C'], ST_GeogFromText('POINT(14.5029 50.1253)')),
('U303Z1P', 'Střížkov',          'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4919 50.1166)')),
('U304Z1P', 'Ládví',             'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4837 50.1093)')),
('U305Z1P', 'Kobylisy',          'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4704 50.1213)')),
('U306Z1P', 'Nádraží Holešovice','metro', ARRAY['C'], ST_GeogFromText('POINT(14.4444 50.1013)')),
('U307Z1P', 'Vltavská',          'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4319 50.1000)')),
('U308Z1P', 'Florenc',           'metro', ARRAY['B','C'], ST_GeogFromText('POINT(14.4399 50.0908)')),
('U309Z1P', 'Hlavní nádraží',    'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4351 50.0829)')),
('U310Z1P', 'Muzeum',            'metro', ARRAY['A','C'], ST_GeogFromText('POINT(14.4294 50.0787)')),
('U311Z1P', 'I.P. Pavlova',      'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4329 50.0750)')),
('U312Z1P', 'Vyšehrad',          'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4270 50.0653)')),
('U313Z1P', 'Pankrác',           'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4324 50.0591)')),
('U314Z1P', 'Budějovická',       'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4397 50.0481)')),
('U315Z1P', 'Kačerov',           'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4454 50.0393)')),
('U316Z1P', 'Roztyly',           'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4522 50.0319)')),
('U317Z1P', 'Chodov',            'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4629 50.0251)')),
('U318Z1P', 'Opatov',            'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4784 50.0186)')),
('U319Z1P', 'Háje',              'metro', ARRAY['C'], ST_GeogFromText('POINT(14.4960 50.0128)')),
-- Key tram stops (line 22 — most useful tourist/residential line)
('T22_001', 'Bílá Hora',         'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3156 50.0711)')),
('T22_002', 'Vypich',            'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3371 50.0737)')),
('T22_003', 'Břevnovský klášter','tram', ARRAY['22'], ST_GeogFromText('POINT(14.3510 50.0784)')),
('T22_004', 'Vozovna Střešovice','tram', ARRAY['22'], ST_GeogFromText('POINT(14.3623 50.0880)')),
('T22_005', 'Malovanka',         'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3722 50.0942)')),
('T22_006', 'Bruselská',         'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3844 50.0996)')),
('T22_007', 'Pohořelec',         'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3924 50.0918)')),
('T22_008', 'Brusnice',          'tram', ARRAY['22'], ST_GeogFromText('POINT(14.3987 50.0918)')),
('T22_009', 'Pražský hrad',      'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4006 50.0898)')),
('T22_010', 'Královský letohrádek','tram', ARRAY['22'], ST_GeogFromText('POINT(14.4016 50.0943)')),
('T22_011', 'Malostranské nám.', 'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4039 50.0866)')),
('T22_012', 'Hellichova',        'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4065 50.0826)')),
('T22_013', 'Újezd',             'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4073 50.0787)')),
('T22_014', 'Národní divadlo',   'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4145 50.0819)')),
('T22_015', 'Karlovy lázně',     'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4153 50.0858)')),
('T22_016', 'Staroměstská',      'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4165 50.0874)')),
('T22_017', 'Právnická fakulta', 'tram', ARRAY['22'], ST_GeogFromText('POINT(14.4179 50.0930)'));