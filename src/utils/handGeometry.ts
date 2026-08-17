import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

const EPSILON = 1e-6

export interface Vector2 {
  x: number
  y: number
}

export function distance(
  first: NormalizedLandmark,
  second: NormalizedLandmark,
) {
  return Math.hypot(
    first.x - second.x,
    first.y - second.y,
    (first.z ?? 0) - (second.z ?? 0),
  )
}

export function angleBetween(
  first: NormalizedLandmark,
  vertex: NormalizedLandmark,
  third: NormalizedLandmark,
) {
  const firstVector = {
    x: first.x - vertex.x,
    y: first.y - vertex.y,
    z: (first.z ?? 0) - (vertex.z ?? 0),
  }
  const secondVector = {
    x: third.x - vertex.x,
    y: third.y - vertex.y,
    z: (third.z ?? 0) - (vertex.z ?? 0),
  }
  const firstLength = Math.hypot(firstVector.x, firstVector.y, firstVector.z)
  const secondLength = Math.hypot(secondVector.x, secondVector.y, secondVector.z)

  if (firstLength < EPSILON || secondLength < EPSILON) return 0

  const cosine =
    (firstVector.x * secondVector.x +
      firstVector.y * secondVector.y +
      firstVector.z * secondVector.z) /
    (firstLength * secondLength)

  return (Math.acos(clamp(cosine, -1, 1)) * 180) / Math.PI
}

export function direction(
  from: NormalizedLandmark,
  to: NormalizedLandmark,
): Vector2 {
  return { x: to.x - from.x, y: to.y - from.y }
}

export function normalizedDot(first: Vector2, second: Vector2) {
  const firstLength = Math.hypot(first.x, first.y)
  const secondLength = Math.hypot(second.x, second.y)

  if (firstLength < EPSILON || secondLength < EPSILON) return 0

  return clamp(
    (first.x * second.x + first.y * second.y) /
      (firstLength * secondLength),
    -1,
    1,
  )
}

export function scoreRange(value: number, closedValue: number, openValue: number) {
  if (Math.abs(openValue - closedValue) < EPSILON) return 0
  return clamp((value - closedValue) / (openValue - closedValue), 0, 1)
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

