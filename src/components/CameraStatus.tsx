import type { CameraStatus as CameraStatusType } from '../types/camera'

interface CameraStatusProps {
  status: CameraStatusType
}

const STATUS_DETAILS: Record<
  CameraStatusType,
  { label: string; dotClassName: string; textClassName: string }
> = {
  ready: {
    label: 'Camera ready',
    dotClassName: 'bg-zinc-400',
    textClassName: 'text-zinc-300',
  },
  starting: {
    label: 'Camera starting',
    dotClassName: 'animate-pulse bg-amber-400',
    textClassName: 'text-amber-200',
  },
  active: {
    label: 'Camera active',
    dotClassName: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]',
    textClassName: 'text-emerald-200',
  },
  stopped: {
    label: 'Camera stopped',
    dotClassName: 'bg-zinc-500',
    textClassName: 'text-zinc-400',
  },
  'permission-denied': {
    label: 'Permission denied',
    dotClassName: 'bg-rose-400',
    textClassName: 'text-rose-200',
  },
  error: {
    label: 'Camera error',
    dotClassName: 'bg-rose-400',
    textClassName: 'text-rose-200',
  },
}

export function CameraStatus({ status }: CameraStatusProps) {
  const details = STATUS_DETAILS[status]

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-white/8 bg-white/4 px-3.5 py-2"
      role="status"
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${details.dotClassName}`} aria-hidden="true" />
      <span className={`text-sm font-medium ${details.textClassName}`}>{details.label}</span>
    </div>
  )
}
