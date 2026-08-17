import { useEffect, useRef } from 'react'
import type { CameraStatus } from '../types/camera'

interface CameraViewProps {
  stream: MediaStream | null
  status: CameraStatus
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5 21 7.5v9l-5.25-3m-9.75 4.5h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5A2.25 2.25 0 0 0 13.5 6H6a2.25 2.25 0 0 0-2.25 2.25v7.5A2.25 2.25 0 0 0 6 18Z" />
    </svg>
  )
}

export function CameraView({ stream, status }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isActive = status === 'active' && stream !== null

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.srcObject = stream

    if (stream) {
      void video.play().catch(() => {
        // The controls remain available if a browser blocks autoplay unexpectedly.
      })
    }

    return () => {
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [stream])

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050607] shadow-2xl shadow-black/35">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.055),transparent_47%)]" />

      <video
        ref={videoRef}
        className={`absolute inset-0 size-full object-cover -scale-x-100 transition-opacity duration-500 ${
          isActive ? 'opacity-100' : 'opacity-0'
        }`}
        autoPlay
        playsInline
        muted
        aria-label="Live mirrored webcam preview"
      />

      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 shadow-inner shadow-white/5">
            {status === 'starting' ? (
              <span className="size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" aria-hidden="true" />
            ) : (
              <CameraIcon />
            )}
          </div>
          <p className="text-base font-medium tracking-tight text-zinc-200">
            {status === 'starting' ? 'Waiting for camera access' : 'Camera preview is off'}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            {status === 'starting'
              ? 'Respond to the permission prompt in your browser.'
              : 'Start the camera when you are ready. Nothing is recorded or uploaded.'}
          </p>
        </div>
      )}

      {isActive && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          Live
        </div>
      )}
    </div>
  )
}
