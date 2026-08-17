export type BackgroundCaptureStatus =
  | 'not-captured'
  | 'countdown'
  | 'validating'
  | 'captured'
  | 'failed'
  | 'incompatible'

export interface CapturedBackgroundMetadata {
  width: number
  height: number
  capturedAt: number
}

export interface BackgroundCaptureState {
  status: BackgroundCaptureStatus
  countdown: number | null
  metadata: CapturedBackgroundMetadata | null
  message: string | null
}

