import { BACKGROUND_CAPTURE_CONFIG } from '../config/backgroundCaptureConfig'
import type {
  PersonCoverageSample,
  PersonSegmentationMask,
} from '../types/segmentation'

export interface BackgroundValidationResult {
  sceneClear: boolean
  averageCoverage: number
  clearSamples: number
  sampleCount: number
}

export function calculatePersonCoverage(mask: PersonSegmentationMask | null) {
  if (!mask || mask.data.length === 0) return 1

  let personPixels = 0
  for (const value of mask.data) {
    if (value >= BACKGROUND_CAPTURE_CONFIG.maskPersonValueThreshold) {
      personPixels += 1
    }
  }
  return personPixels / mask.data.length
}

export function validateBackgroundScene(
  samples: readonly PersonCoverageSample[],
  now: number,
): BackgroundValidationResult {
  const recentSamples = samples
    .filter(
      (sample) =>
        now - sample.timestampMs <=
        BACKGROUND_CAPTURE_CONFIG.maximumSampleAgeMs,
    )
    .slice(-BACKGROUND_CAPTURE_CONFIG.validationWindowSize)

  if (recentSamples.length === 0) {
    return {
      sceneClear: false,
      averageCoverage: 1,
      clearSamples: 0,
      sampleCount: 0,
    }
  }

  const clearSamples = recentSamples.filter(
    (sample) =>
      sample.coverage <= BACKGROUND_CAPTURE_CONFIG.personCoverageThreshold,
  ).length
  const averageCoverage =
    recentSamples.reduce((total, sample) => total + sample.coverage, 0) /
    recentSamples.length
  const hasFullWindow =
    recentSamples.length >= BACKGROUND_CAPTURE_CONFIG.validationWindowSize

  return {
    sceneClear:
      hasFullWindow &&
      clearSamples >= BACKGROUND_CAPTURE_CONFIG.minimumClearSamples &&
      averageCoverage <= BACKGROUND_CAPTURE_CONFIG.personCoverageThreshold,
    averageCoverage,
    clearSamples,
    sampleCount: recentSamples.length,
  }
}

