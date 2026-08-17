import { INVISIBILITY_CONFIG } from '../config/invisibilityConfig'
import type { PersonSegmentationMask } from '../types/segmentation'

export interface ProcessedAlphaMask {
  rgba: Uint8ClampedArray
  width: number
  height: number
  hasPerson: boolean
  motion: number
  bufferVersion: number
}

export function smoothstep(edgeStart: number, edgeEnd: number, value: number) {
  const normalized = Math.min(
    Math.max((value - edgeStart) / Math.max(edgeEnd - edgeStart, 1e-6), 0),
    1,
  )
  return normalized * normalized * (3 - 2 * normalized)
}

export class PersonAlphaMaskProcessor {
  private currentAlpha = new Float32Array(0)
  private smoothedAlpha = new Float32Array(0)
  private rgba = new Uint8ClampedArray(0)
  private hasPreviousMask = false
  private bufferVersion = 0

  clear() {
    this.currentAlpha = new Float32Array(0)
    this.smoothedAlpha = new Float32Array(0)
    this.rgba = new Uint8ClampedArray(0)
    this.hasPreviousMask = false
    this.bufferVersion += 1
  }

  private ensureSize(pixelCount: number) {
    if (this.currentAlpha.length === pixelCount) return
    this.currentAlpha = new Float32Array(pixelCount)
    this.smoothedAlpha = new Float32Array(pixelCount)
    this.rgba = new Uint8ClampedArray(pixelCount * 4)
    this.hasPreviousMask = false
    this.bufferVersion += 1
  }

  process(
    mask: PersonSegmentationMask,
    temporalSmoothingEnabled: boolean,
  ): ProcessedAlphaMask {
    this.ensureSize(mask.data.length)

    let totalChange = 0
    for (let index = 0; index < mask.data.length; index += 1) {
      const confidence = (mask.data[index] ?? 0) / 255
      const remapped = smoothstep(
        INVISIBILITY_CONFIG.personThresholdLow,
        INVISIBILITY_CONFIG.personThresholdHigh,
        confidence,
      )
      this.currentAlpha[index] = remapped
      if (this.hasPreviousMask) {
        totalChange += Math.abs(remapped - (this.smoothedAlpha[index] ?? 0))
      }
    }

    const motion = this.hasPreviousMask
      ? totalChange / Math.max(mask.data.length, 1)
      : 1
    const motionFactor = smoothstep(
      INVISIBILITY_CONFIG.fastMotionChangeLow,
      INVISIBILITY_CONFIG.fastMotionChangeHigh,
      motion,
    )
    const historyWeight = temporalSmoothingEnabled && this.hasPreviousMask
      ? INVISIBILITY_CONFIG.temporalSmoothing * (1 - motionFactor) +
        INVISIBILITY_CONFIG.fastMotionSmoothing * motionFactor
      : 0
    let personPixelCount = 0

    for (
      let maskIndex = 0, pixelIndex = 0;
      maskIndex < mask.data.length;
      maskIndex += 1, pixelIndex += 4
    ) {
      const alpha =
        (this.smoothedAlpha[maskIndex] ?? 0) * historyWeight +
        (this.currentAlpha[maskIndex] ?? 0) * (1 - historyWeight)
      this.smoothedAlpha[maskIndex] = alpha
      const byteAlpha = Math.round(alpha * 255)
      this.rgba[pixelIndex] = 255
      this.rgba[pixelIndex + 1] = 255
      this.rgba[pixelIndex + 2] = 255
      this.rgba[pixelIndex + 3] = byteAlpha
      if (byteAlpha >= INVISIBILITY_CONFIG.personAlphaThreshold) {
        personPixelCount += 1
      }
    }

    this.hasPreviousMask = true
    return {
      rgba: this.rgba,
      width: mask.width,
      height: mask.height,
      hasPerson:
        personPixelCount / Math.max(mask.data.length, 1) >=
        INVISIBILITY_CONFIG.minimumPersonCoverage,
      motion,
      bufferVersion: this.bufferVersion,
    }
  }
}
