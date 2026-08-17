import { useCanvasRenderer } from '../hooks/useCanvasRenderer'
import type { CameraStatus } from '../types/camera'
import type { CanvasStatus } from '../types/canvas'
import { StatusPanel } from './StatusPanel'

interface CameraCanvasProps {
  stream: MediaStream | null
  cameraStatus: CameraStatus
  error: string | null
}

function CanvasIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75A2.25 2.25 0 0 1 6.75 4.5h10.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H6.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 15 2.1-2.1a1.2 1.2 0 0 1 1.7 0l.7.7 1.95-1.95a1.2 1.2 0 0 1 1.7 0L18 14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25h.008v.008h-.008V8.25Z" />
    </svg>
  )
}

function getPlaceholder(cameraStatus: CameraStatus, canvasStatus: CanvasStatus, error: string | null) {
  if (cameraStatus === 'starting') {
    return {
      title: 'Starting camera...',
      description: 'Respond to the permission prompt in your browser.',
      loading: true,
    }
  }

  if (cameraStatus === 'permission-denied' || cameraStatus === 'error' || canvasStatus === 'error') {
    return {
      title: 'Canvas output unavailable',
      description: error ?? 'The source video could not be rendered to the canvas.',
      loading: false,
    }
  }

  if (cameraStatus === 'active') {
    return {
      title: 'Preparing canvas output...',
      description: 'Waiting for valid video dimensions and the first camera frame.',
      loading: true,
    }
  }

  return {
    title: 'Camera is not active',
    description: 'Start the camera to begin the real-time canvas rendering pipeline.',
    loading: false,
  }
}

export function CameraCanvas({ stream, cameraStatus, error }: CameraCanvasProps) {
  const { videoRef, canvasRef, canvasStatus, metrics } = useCanvasRenderer({
    stream,
    isCameraActive: cameraStatus === 'active',
  })
  const isRendering = canvasStatus === 'rendering'
  const placeholder = getPlaceholder(cameraStatus, canvasStatus, error)

  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050607] shadow-2xl shadow-black/35">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.055),transparent_47%)]" />

        <video
          ref={videoRef}
          className="pointer-events-none absolute -left-[9999px] size-px opacity-0"
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          tabIndex={-1}
        />

        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 size-full object-contain"
          aria-label="Live mirrored camera canvas output"
        />

        {!isRendering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050607]/75 px-6 text-center backdrop-blur-[2px]">
            <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 shadow-inner shadow-white/5">
              {placeholder.loading ? (
                <span className="size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" aria-hidden="true" />
              ) : (
                <CanvasIcon />
              )}
            </div>
            <p className="text-base font-medium tracking-tight text-zinc-200">{placeholder.title}</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">{placeholder.description}</p>
          </div>
        )}

        {isRendering && (
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Canvas live
            </div>
            <div className="rounded-full bg-black/55 px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-100 backdrop-blur-md">
              {metrics.fps} FPS
            </div>
          </div>
        )}
      </div>

      <StatusPanel cameraStatus={cameraStatus} canvasStatus={canvasStatus} metrics={metrics} />
    </>
  )
}
