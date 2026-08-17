export type GestureName =
  | 'OPEN_PALM'
  | 'FIST'
  | 'PEACE'
  | 'THUMBS_UP'
  | 'UNKNOWN'

export type GestureHandedness = 'Left' | 'Right'

export interface FingerState {
  thumb: boolean
  index: boolean
  middle: boolean
  ring: boolean
  pinky: boolean
}

export interface FingerScores {
  thumb: number
  index: number
  middle: number
  ring: number
  pinky: number
}

export interface FingerAnalysis {
  state: FingerState
  scores: FingerScores
}

export interface GesturePrediction {
  gesture: GestureName
  confidence: number
  fingers: FingerState
}

export interface HandGestureState extends GesturePrediction {
  hand: GestureHandedness
  rawGesture: GestureName
  stableForMs: number
  lastSeenAt: number
}

export type HandGestureMap = Partial<Record<GestureHandedness, HandGestureState>>

