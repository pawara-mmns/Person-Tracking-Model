import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export type HandTrackingStatus = 'loading' | 'ready' | 'active' | 'error'

export interface HandTrackingState {
  status: HandTrackingStatus
  handsDetected: number
  aiFps: number
  error: string | null
}

export interface HandConnection {
  start: number
  end: number
}

export type HandWorkerRequest =
  | {
      type: 'DETECT_FRAME'
      bitmap: ImageBitmap
      timestampMs: number
      sessionId: number
    }
  | { type: 'DISPOSE' }

export type HandWorkerResponse =
  | { type: 'MODEL_READY'; connections: HandConnection[] }
  | { type: 'MODEL_ERROR'; error: string }
  | {
      type: 'DETECTION_RESULT'
      result: HandLandmarkerResult
      sessionId: number
    }
  | { type: 'DETECTION_ERROR'; error: string; sessionId: number }
  | { type: 'DISPOSED' }
