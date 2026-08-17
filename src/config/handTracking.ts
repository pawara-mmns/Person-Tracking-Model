const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export const HAND_TRACKING_CONFIG = Object.freeze({
  maxHands: 2,
  detectionConfidence: 0.5,
  presenceConfidence: 0.5,
  trackingConfidence: 0.5,
  targetFps: 25,
  metricsSampleIntervalMs: 750,
  modelAssetPath: `${baseUrl}mediapipe/models/hand_landmarker.task`,
})

export const HAND_OVERLAY_STYLE = Object.freeze({
  connectionWidth: 2.5,
  landmarkRadius: 3.5,
  landmarkBorderWidth: 1.5,
  labelFont: '600 12px ui-sans-serif, system-ui, sans-serif',
  handColors: ['#5eead4', '#fbbf24'] as const,
})
