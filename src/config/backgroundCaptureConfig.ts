export const BACKGROUND_CAPTURE_CONFIG = Object.freeze({
  countdownSeconds: 3,
  exposureSettlingDelayMs: 500,
  backgroundFrameCount: 20,
  backgroundFrameIntervalMs: 50,
  personCoverageThreshold: 0.03,
  validationWindowSize: 5,
  minimumClearSamples: 4,
  maximumSampleAgeMs: 1200,
  maskPersonValueThreshold: 128,
})
