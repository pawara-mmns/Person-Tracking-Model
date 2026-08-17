export type CameraStatus =
  | 'ready'
  | 'starting'
  | 'active'
  | 'stopped'
  | 'permission-denied'
  | 'error'

export interface CameraState {
  stream: MediaStream | null
  status: CameraStatus
  error: string | null
}
