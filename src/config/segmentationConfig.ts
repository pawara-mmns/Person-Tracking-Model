const configuredBaseUrl = import.meta.env?.BASE_URL ?? '/'
const baseUrl = configuredBaseUrl.endsWith('/')
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`

export const SEGMENTATION_CONFIG = Object.freeze({
  targetFps: 15,
  metricsSampleIntervalMs: 750,
  coverageHistorySize: 12,
  personMaskThreshold: 0.5,
  edgeFeather: 0.12,
  temporalCurrentFrameWeight: 0.68,
  overlayOpacity: 0.58,
  overlayColor: Object.freeze({ red: 20, green: 184, blue: 166 }),
  modelAssetPath: `${baseUrl}mediapipe/models/selfie_segmenter.tflite`,
})
