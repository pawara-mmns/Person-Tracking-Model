import { SEGMENTATION_CONFIG } from '../config/segmentationConfig'

export interface ProcessedPersonMask {
  mask: Uint8ClampedArray
  confidenceBuffer: Float32Array
  averagePersonConfidence: number
  personCoverage: number
}

export function processPersonConfidenceMask(
  currentMask: Float32Array,
  reusableBuffer: Float32Array | null,
): ProcessedPersonMask {
  // Preserve MediaPipe's confidence information for the Phase 07.1 compositor.
  // Confidence-to-alpha remapping and adaptive temporal smoothing happen there.
  const confidenceBuffer =
    reusableBuffer?.length === currentMask.length
      ? reusableBuffer
      : new Float32Array(currentMask.length)
  const outputMask = new Uint8ClampedArray(currentMask.length)
  let personConfidenceTotal = 0
  let personPixelCount = 0

  for (let index = 0; index < currentMask.length; index += 1) {
    const confidence = Math.min(Math.max(currentMask[index] ?? 0, 0), 1)
    confidenceBuffer[index] = confidence
    outputMask[index] = Math.round(confidence * 255)

    if (confidence >= SEGMENTATION_CONFIG.personMaskThreshold) {
      personConfidenceTotal += confidence
      personPixelCount += 1
    }
  }

  return {
    mask: outputMask,
    confidenceBuffer,
    averagePersonConfidence:
      personPixelCount > 0 ? personConfidenceTotal / personPixelCount : 0,
    personCoverage:
      currentMask.length > 0 ? personPixelCount / currentMask.length : 0,
  }
}
