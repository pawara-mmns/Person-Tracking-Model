import type { ReactNode } from 'react'
import type { CameraStatus } from '../types/camera'
import type { CanvasStatus, RenderMetrics } from '../types/canvas'

interface StatusPanelProps {
  cameraStatus: CameraStatus
  canvasStatus: CanvasStatus
  metrics: RenderMetrics
}

const CAMERA_LABELS: Record<CameraStatus, string> = {
  ready: 'Ready',
  starting: 'Starting',
  active: 'Active',
  stopped: 'Stopped',
  'permission-denied': 'Denied',
  error: 'Error',
}

const CANVAS_LABELS: Record<CanvasStatus, string> = {
  idle: 'Inactive',
  waiting: 'Waiting',
  rendering: 'Active',
  error: 'Error',
}

function StatusValue({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span className={active ? 'font-medium text-emerald-300' : 'font-medium text-zinc-300'}>
      {children}
    </span>
  )
}

export function StatusPanel({ cameraStatus, canvasStatus, metrics }: StatusPanelProps) {
  const isRendering = canvasStatus === 'rendering'

  return (
    <div className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border border-white/8 bg-white/3 px-4 py-4 text-xs sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Camera</span>
        <div className="lg:mt-1.5">
          <StatusValue active={cameraStatus === 'active'}>{CAMERA_LABELS[cameraStatus]}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Canvas</span>
        <div className="lg:mt-1.5">
          <StatusValue active={isRendering}>{CANVAS_LABELS[canvasStatus]}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Frame rate</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={isRendering}>{isRendering ? `${metrics.fps} FPS` : '-- FPS'}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Rendered frames</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue>{metrics.frameCount.toLocaleString()}</StatusValue>
        </div>
      </div>
    </div>
  )
}
