-- Isochrone feature — transit travel times + BFS calculation
-- 1. Creates transit_travel_times table
-- 2. Populates with precomputed edge data
-- 3. Creates RPC: calculate_isochrone(lat, lng, minutes) → reachable stops

-- ── Step 1: Table ──
CREATE TABLE IF NOT EXISTS transit_travel_times (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  line_name TEXT NOT NULL,
  from_stop_id TEXT NOT NULL,
  to_stop_id TEXT NOT NULL,
  avg_seconds INTEGER NOT NULL CHECK (avg_seconds > 0),
  num_samples INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ttt_from_stop ON transit_travel_times (from_stop_id);
CREATE INDEX IF NOT EXISTS idx_ttt_to_stop ON transit_travel_times (to_stop_id);
CREATE INDEX IF NOT EXISTS idx_ttt_line ON transit_travel_times (line_name);

-- ── Step 2: BFS Isochrone RPC ──
-- Returns reachable stops from a given point within N minutes (transit + walking)
CREATE OR REPLACE FUNCTION calculate_isochrone(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_minutes INTEGER
) RETURNS TABLE(
  stop_id TEXT,
  stop_name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  total_seconds INTEGER
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_walk_secs CONSTANT INTEGER := 180;      -- ~300 m walking at 1.4 m/s
  v_walk_deg  CONSTANT DOUBLE PRECISION := 0.003;  -- ~330 m in degrees
  v_max_seconds INTEGER := GREATEST(p_minutes * 60, v_walk_secs + 60);
  v_stop RECORD;
  v_dist DOUBLE PRECISION;
  v_current TEXT;
  v_current_time INTEGER;
  v_new_time INTEGER;
  v_stop_row RECORD;
  v_walk_time INTEGER;
BEGIN
  -- ── Phase 1: Seed table with nearest stops ) ──

  CREATE TEMP TABLE IF NOT EXISTS _iso_state (
    stop_id TEXT PRIMARY KEY,
    total_seconds INTEGER NOT NULL
  ) ON COMMIT DROP;

  CREATE TEMP TABLE IF NOT EXISTS _iso_result (
    stop_id TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION NOT NULL DEFAULT 0,
    lon DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL
  ) ON COMMIT DROP;

  -- Find stops within walking distance of the click point
  FOR v_stop IN
    SELECT s.gtfs_stop_id, s.name, s.lat, s.lon,
      SQRT(
        (s.lat - p_lat)^2 +
        ((s.lon - p_lng) * COS(RADIANS((s.lat + p_lat)/2)))^2
      ) * 111320 AS dist
    FROM pid_stations s
    WHERE s.lat IS NOT NULL AND s.lon IS NOT NULL
      AND s.lat BETWEEN p_lat - v_walk_deg AND p_lat + v_walk_deg
      AND s.lon BETWEEN p_lng - v_walk_deg AND p_lng + v_walk_deg
  LOOP
    v_dist := v_stop.dist;
    IF v_dist <= 300 THEN  -- 300 m walking radius
      v_walk_time := GREATEST(60, ROUND(v_dist / 1.4)::INTEGER);
      INSERT INTO _iso_state (stop_id, total_seconds) VALUES (v_stop.gtfs_stop_id, v_walk_time)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- If nothing nearby, return empty
  IF NOT EXISTS (SELECT 1 FROM _iso_state) THEN
    RETURN;
  END IF;

  -- ── Phase 2: BFS (Dijkstra-like) on the transit graph ──
  LOOP
    -- Pick unprocessed stop with smallest total_seconds
    SELECT s.stop_id, s.total_seconds INTO v_current, v_current_time
    FROM _iso_state s
    WHERE NOT EXISTS (SELECT 1 FROM _iso_result r WHERE r.stop_id = s.stop_id)
    ORDER BY s.total_seconds
    LIMIT 1;
    EXIT WHEN NOT FOUND;

    -- Mark as processed ("visited")
    INSERT INTO _iso_result (stop_id, stop_name, lat, lon, total_seconds)
      SELECT s.gtfs_stop_id, s.name, s.lat, s.lon, v_current_time
      FROM pid_stations s WHERE s.gtfs_stop_id = v_current
    ON CONFLICT DO NOTHING;

    -- Explore forward edges: from_stop = current
    FOR v_stop_row IN
      SELECT t.to_stop_id, v_current_time + t.avg_seconds AS new_time
      FROM transit_travel_times t
      WHERE t.from_stop_id = v_current
        AND v_current_time + t.avg_seconds <= v_max_seconds
        AND NOT EXISTS (SELECT 1 FROM _iso_result r WHERE r.stop_id = t.to_stop_id)
    LOOP
      INSERT INTO _iso_state (stop_id, total_seconds) VALUES (v_stop_row.to_stop_id, v_stop_row.new_time)
      ON CONFLICT (stop_id) DO UPDATE SET total_seconds = LEAST(_iso_state.total_seconds, v_stop_row.new_time)
        WHERE EXCLUDED.total_seconds < _iso_state.total_seconds;
    END LOOP;

    -- Explore backward edges: to_stop = current (travel works both directions)
    FOR v_stop_row IN
      SELECT t.from_stop_id, v_current_time + t.avg_seconds AS new_time
      FROM transit_travel_times t
      WHERE t.to_stop_id = v_current
        AND v_current_time + t.avg_seconds <= v_max_seconds
        AND NOT EXISTS (SELECT 1 FROM _iso_result r WHERE r.stop_id = t.from_stop_id)
    LOOP
      INSERT INTO _iso_state (stop_id, total_seconds) VALUES (v_stop_row.from_stop_id, v_stop_row.new_time)
      ON CONFLICT (stop_id) DO UPDATE SET total_seconds = LEAST(_iso_state.total_seconds, v_stop_row.new_time)
        WHERE EXCLUDED.total_seconds < _iso_state.total_seconds;
    END LOOP;
  END LOOP;

  -- Return visited stops
  RETURN QUERY
  SELECT r.stop_id, r.stop_name, r.lat, r.lon, r.total_seconds
  FROM _iso_result r
  ORDER BY r.total_seconds;
END;
$$;

ANALYZE transit_travel_times;
