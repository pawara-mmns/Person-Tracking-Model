export type InvisibilityStatus = 'unavailable' | 'ready' | 'active'

export type InvisibilityDebugView =
  | 'final'
  | 'processed-mask'
  | 'background-plate'
  | 'split'

export interface InvisibilityQualitySettings {
  featheringEnabled: boolean
  temporalSmoothingEnabled: boolean
  colorMatchingEnabled: boolean
  debugView: InvisibilityDebugView
}

export interface InvisibilityRuntimeStatus {
  maskFresh: boolean
  maskMotion: number
  colorMatchActive: boolean
  colorMismatch: number
}

export interface InvisibilityRenderState {
  enabled: boolean
  showHandOverlay: boolean
  backgroundVersion: number | null
  quality: InvisibilityQualitySettings
}

export interface InvisibilityState {
  status: InvisibilityStatus
  isEnabled: boolean
  showOriginalFrame: boolean
  showHandOverlay: boolean
  validationError: string | null
  qualityWarning: string | null
}
