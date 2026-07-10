/**
 * Isochrone polygon utilities.
 * Star-shaped polygon from reachable stops around a center point.
 * Each angular bin keeps the farthest reachable stop, creating natural
 * concave bays in directions without transit connections.
 * Radial smoothing prevents extreme spikes from isolated far stops.
 *
 * Note: The actual polygon computation now happens server-side in the
 * calculate_isochrone_polygon Postgres function. This file only retains
 * client-side utilities (point-in-polygon test for listing filtering).
 */

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
