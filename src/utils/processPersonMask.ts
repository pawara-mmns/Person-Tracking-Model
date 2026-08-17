import { SEGMENTATION_CONFIG } from '../config/segmentationConfig'

export interface ProcessedPersonMask {
  mask: Uint8ClampedArray
  smoothedMask: Float32Array
  averagePersonConfidence: number
  personCoverage: number
}

function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const normalized = Math.min(
    Math.max((value - edgeStart) / Math.max(edgeEnd - edgeStart, 1e-6), 0),
    1,
  )
  return normalized * normalized * (3 - 2 * normalized)
}

export function processPersonConfidenceMask(
  currentMask: Float32Array,
  previousMask: Float32Array | null,
): ProcessedPersonMask {
  const smoothedMask =
    previousMask?.length === currentMask.length
      ? previousMask
      : new Float32Array(currentMask)
  const outputMask = new Uint8ClampedArray(currentMask.length)
  const currentWeight = SEGMENTATION_CONFIG.temporalCurrentFrameWeight
  const previousWeight = 1 - currentWeight
  const lowerEdge =
    SEGMENTATION_CONFIG.personMaskThreshold - SEGMENTATION_CONFIG.edgeFeather
  const upperEdge =
    SEGMENTATION_CONFIG.personMaskThreshold + SEGMENTATION_CONFIG.edgeFeather
  let personConfidenceTotal = 0
  let personPixelCount = 0

  for (let index = 0; index < currentMask.length; index += 1) {
    const confidence = Math.min(Math.max(currentMask[index] ?? 0, 0), 1)
    const smoothedConfidence =
      confidence * currentWeight +
      (smoothedMask[index] ?? confidence) * previousWeight
    smoothedMask[index] = smoothedConfidence
    outputMask[index] = Math.round(
      smoothstep(lowerEdge, upperEdge, smoothedConfidence) * 255,
    )

    if (smoothedConfidence >= SEGMENTATION_CONFIG.personMaskThreshold) {
      personConfidenceTotal += smoothedConfidence
      personPixelCount += 1
    }
  }

  return {
    mask: outputMask,
    smoothedMask,
    averagePersonConfidence:
      personPixelCount > 0 ? personConfidenceTotal / personPixelCount : 0,
    personCoverage:
      currentMask.length > 0 ? personPixelCount / currentMask.length : 0,
  }
}

