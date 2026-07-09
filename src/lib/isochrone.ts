/**
 * Isochrone polygon utilities.
 * Convex hull (Graham scan) + interpolation for natural-looking zones.
 */

interface Point {
  x: number; y: number
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/**
 * Convex hull of a set of [lng, lat] points using Graham scan.
 */
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points

  const pts: Point[] = points.map(p => ({ x: p[0], y: p[1] }))

  // Find bottom-most (and leftmost if tie)
  let bottom = 0
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < pts[bottom].y || (pts[i].y === pts[bottom].y && pts[i].x < pts[bottom].x)) {
      bottom = i
    }
  }
  ;[pts[0], pts[bottom]] = [pts[bottom], pts[0]]

  const pivot = pts[0]
  pts.sort((a, b) => {
    const c = cross(pivot, a, b)
    if (c === 0) {
      const da = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2
      const db = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2
      return da - db
    }
    return -c
  })

  const hull: Point[] = []
  for (const p of pts) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) {
      hull.pop()
    }
    hull.push(p)
  }

  return hull.map(p => [p.x, p.y] as [number, number])
}

/**
 * Expand a convex hull outward from its centroid to create a more natural
 * travel-zone appearance. The expansion is proportional to the hull's size:
 * 20% of the average vertex-to-centroid distance, clamped to [0.0005, 0.005].
 *
 * Then interpolates extra mid-edge points so the polygon is smooth.
 */
export function expandHull(
  hull: [number, number][],
  _unused?: number  // kept for backward compat, ignored
): [number, number][] {
  if (hull.length < 3) return hull

  // Centroid of hull
  let cx = 0, cy = 0
  for (const [x, y] of hull) { cx += x; cy += y }
  cx /= hull.length; cy /= hull.length

  // Average distance from centroid → determines proportional buffer
  let avgDist = 0
  for (const [x, y] of hull) {
    avgDist += Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
  }
  avgDist /= hull.length

  // Buffer = 20% of average distance, clamped to [0.0005, 0.005]
  // (0.001 ≈ 110m at Prague latitude)
  const bufferDeg = Math.max(0.0005, Math.min(0.005, avgDist * 0.2))

  // Expand each vertex outward from centroid
  const expanded: Point[] = hull.map(([x, y]) => {
    const dx = x - cx, dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist === 0) return { x, y }
    const factor = 1 + bufferDeg / dist
    return { x: cx + dx * factor, y: cy + dy * factor }
  })

  // Interpolate extra points along edges (2 per edge = 3x vertices)
  const smooth: [number, number][] = []
  for (let i = 0; i < expanded.length; i++) {
    const a = expanded[i]
    const b = expanded[(i + 1) % expanded.length]
    // 3 segments per edge
    for (let t = 0; t < 3; t++) {
      const frac = t / 3
      smooth.push([
        a.x + (b.x - a.x) * frac,
        a.y + (b.y - a.y) * frac,
      ])
    }
  }

  // Run convex hull again on expanded + interpolated points to keep it clean
  return convexHull(smooth)
}

/**
 * Ray-casting point-in-polygon test for [lng, lat].
 */
export function pointInConvexPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false
  const [px, py] = point

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
