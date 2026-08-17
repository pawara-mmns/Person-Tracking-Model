interface CameraControlsProps {
  isActive: boolean
  isStarting: boolean
  onStart: () => void
  onStop: () => void
}

export function CameraControls({
  isActive,
  isStarting,
  onStart,
  onStop,
}: CameraControlsProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onStart}
        disabled={isActive || isStarting}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:flex-none sm:min-w-40"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25v13.5l13.5-6.75-13.5-6.75Z" />
        </svg>
        {isStarting ? 'Starting...' : 'Start camera'}
      </button>

      <button
        type="button"
        onClick={onStop}
        disabled={!isActive && !isStarting}
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 px-5 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-transparent disabled:text-zinc-600 sm:flex-none sm:min-w-40"
      >
        <span className="size-3.5 rounded-[3px] border-2 border-current" aria-hidden="true" />
        Stop camera
      </button>
    </div>
  )
}
