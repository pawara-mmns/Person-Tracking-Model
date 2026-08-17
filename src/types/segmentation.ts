export type SegmentationStatus = 'loading' | 'ready' | 'active' | 'error'

export type SegmentationDebugMode = 'off' | 'overlay' | 'mask'

export interface PersonSegmentationMask {
  data: Uint8ClampedArray
  width: number
  height: number
  timestampMs: number
  version: number
}

export interface PersonSegmentationState {
  status: SegmentationStatus
  segmentationFps: number
  averagePersonConfidence: number
  personCoverage: number
  error: string | null
}

export type SegmentationWorkerRequest =
  | {
      type: 'SEGMENT_FRAME'
      bitmap: ImageBitmap
      timestampMs: number
      sessionId: number
    }
  | { type: 'RESET' }
  | { type: 'DISPOSE' }

export type SegmentationWorkerResponse =
  | { type: 'MODEL_READY' }
  | { type: 'MODEL_ERROR'; error: string }
  | {
      type: 'SEGMENTATION_RESULT'
      mask: Uint8ClampedArray
      width: number
      height: number
      timestampMs: number
      sessionId: number
      averagePersonConfidence: number
      personCoverage: number
    }
  | { type: 'SEGMENTATION_ERROR'; error: string; sessionId: number }
  | { type: 'DISPOSED' }

