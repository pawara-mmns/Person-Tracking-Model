export type CanvasStatus = 'idle' | 'waiting' | 'rendering' | 'error'

export interface RenderMetrics {
  fps: number
  frameCount: number
  width: number
  height: number
}
