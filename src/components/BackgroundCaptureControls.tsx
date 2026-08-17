import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type {
  BackgroundCaptureStatus,
  CapturedBackgroundMetadata,
} from '../types/background'

interface BackgroundCaptureControlsProps {
  status: BackgroundCaptureStatus
  countdown: number | null
  metadata: CapturedBackgroundMetadata | null
  message: string | null
  backgroundCanvasRef: RefObject<HTMLCanvasElement | null>
  sceneClear: boolean
  personCoverage: number
  canCapture: boolean
  isCapturing: boolean
  onCapture: () => void
  onCancel: () => void
  onClear: () => void
}

const STATUS_LABELS: Record<BackgroundCaptureStatus, string> = {
  'not-captured': 'Not captured',
  countdown: 'Countdown',
  validating: 'Validating',
  captured: 'Ready',
  failed: 'Failed',
  incompatible: 'Recapture required',
}

export function BackgroundCaptureControls({
  status,
  countdown,
  metadata,
  message,
  backgroundCanvasRef,
  sceneClear,
  personCoverage,
  canCapture,
  isCapturing,
  onCapture,
  onCancel,
  onClear,
}: BackgroundCaptureControlsProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const source = backgroundCanvasRef.current
    const preview = previewCanvasRef.current
    if (!source || !preview || !metadata) return

    const previewWidth = 320
    const previewHeight = Math.max(
      1,
      Math.round((previewWidth * metadata.height) / metadata.width),
    )
    preview.width = previewWidth
    preview.height = previewHeight
    const context = preview.getContext('2d', { alpha: false })
    context?.drawImage(source, 0, 0, previewWidth, previewHeight)
  }, [backgroundCanvasRef, metadata])

  const hasBackground = metadata !== null
  const statusIsHealthy = status === 'captured'

  return (
    <section className="mt-4 rounded-xl border border-white/8 bg-white/3 p-4 sm:p-5" aria-labelledby="background-capture-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Phase 06
          </p>
          <h3 id="background-capture-heading" className="mt-1 text-sm font-semibold text-zinc-200">
            Clean background capture
          </h3>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-zinc-500">
            Move completely out of frame before the countdown finishes. Only the raw camera frame is stored.
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            statusIsHealthy
              ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-300'
              : status === 'failed' || status === 'incompatible'
                ? 'border-rose-300/20 bg-rose-300/8 text-rose-200'
                : 'border-white/8 bg-white/3 text-zinc-400'
          }`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-white/7 bg-black/15 px-3 py-2.5 text-xs">
          <span className="text-zinc-500">Scene clear</span>
          <span className={sceneClear ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
            {sceneClear ? 'YES' : 'NO'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/7 bg-black/15 px-3 py-2.5 text-xs">
          <span className="text-zinc-500">Person coverage</span>
          <span className="font-mono text-zinc-300">{(personCoverage * 100).toFixed(1)}%</span>
        </div>
      </div>

      {isCapturing && (
        <div className="mt-4 grid min-h-28 place-items-center rounded-xl border border-emerald-300/15 bg-emerald-300/5 text-center">
          {status === 'countdown' ? (
            <div>
              <p className="font-mono text-4xl font-semibold text-emerald-200">{countdown}</p>
              <p className="mt-2 text-xs text-zinc-400">Please move out of the camera frame.</p>
            </div>
          ) : (
            <div>
              <span className="mx-auto block size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-300" />
              <p className="mt-3 text-xs text-zinc-300">Capturing and validating...</p>
            </div>
          )}
        </div>
      )}

      {message && !isCapturing && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2.5 text-xs leading-5 ${
            status === 'failed' || status === 'incompatible'
              ? 'border-rose-300/15 bg-rose-300/6 text-rose-100'
              : 'border-white/7 bg-black/15 text-zinc-400'
          }`}
        >
          {message}
        </p>
      )}

      {metadata && (
        <div className="mt-4 grid gap-4 rounded-xl border border-white/8 bg-black/20 p-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
          <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
            <canvas
              ref={previewCanvasRef}
              className="block aspect-video w-full scale-x-[-1] object-cover"
              aria-label="Mirrored preview of the captured clean background"
            />
          </div>
          <div className="text-xs leading-5 text-zinc-500">
            <p className="font-medium text-zinc-300">Captured background</p>
            <p className="mt-1 font-mono">{metadata.width} × {metadata.height}</p>
            <p>{new Date(metadata.capturedAt).toLocaleTimeString()}</p>
            <p className="mt-2">The preview is mirrored for display; the stored clean plate remains in raw camera coordinates.</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isCapturing && (
          <button
            type="button"
            disabled={!canCapture}
            onClick={onCapture}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {hasBackground ? 'Retake background' : 'Capture background'}
          </button>
        )}
        {isCapturing && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/4 px-4 text-xs font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/7"
          >
            Cancel capture
          </button>
        )}
        {(hasBackground || status === 'failed' || status === 'incompatible') && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/4 px-4 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          >
            Clear background
          </button>
        )}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-zinc-600">
        Keep the camera stationary and avoid major room-lighting changes after capture.
      </p>
    </section>
  )
}

