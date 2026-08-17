import type { InvisibilityStatus } from '../types/invisibility'

interface InvisibilityControlsProps {
  status: InvisibilityStatus
  isAvailable: boolean
  isEnabled: boolean
  showOriginalFrame: boolean
  showHandOverlay: boolean
  validationError: string | null
  qualityWarning: string | null
  onToggleInvisible: () => void
  onShowOriginalFrameChange: (enabled: boolean) => void
  onShowHandOverlayChange: (enabled: boolean) => void
}

const STATUS_LABELS: Record<InvisibilityStatus, string> = {
  unavailable: 'Unavailable',
  ready: 'Ready',
  active: 'Active',
}

function ToggleButton({
  active,
  disabled = false,
  label,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/8 bg-black/15 px-3.5 text-xs text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span>{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          active ? 'bg-emerald-300' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
            active ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export function InvisibilityControls({
  status,
  isAvailable,
  isEnabled,
  showOriginalFrame,
  showHandOverlay,
  validationError,
  qualityWarning,
  onToggleInvisible,
  onShowOriginalFrameChange,
  onShowHandOverlayChange,
}: InvisibilityControlsProps) {
  return (
    <section
      className="mt-4 rounded-xl border border-white/8 bg-white/3 p-4 sm:p-5"
      aria-labelledby="invisibility-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Phase 07.1
          </p>
          <h3 id="invisibility-heading" className="mt-1 text-sm font-semibold text-zinc-200">
            Enhanced invisibility compositing
          </h3>
          <p className="mt-1.5 max-w-xl text-xs leading-5 text-zinc-500">
            The clean plate replaces only person-mask pixels. The rest of the scene stays live.
          </p>
        </div>
        <span
          className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            status === 'active'
              ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-300'
              : status === 'ready'
                ? 'border-teal-300/20 bg-teal-300/8 text-teal-200'
                : 'border-white/8 bg-white/3 text-zinc-500'
          }`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ToggleButton
          active={isEnabled}
          disabled={!isAvailable}
          label="Invisible Mode"
          onClick={onToggleInvisible}
        />
        <ToggleButton
          active={showOriginalFrame}
          disabled={!isEnabled}
          label="Show original frame"
          onClick={() => onShowOriginalFrameChange(!showOriginalFrame)}
        />
        <ToggleButton
          active={showHandOverlay}
          label="Show hand overlay"
          onClick={() => onShowHandOverlayChange(!showHandOverlay)}
        />
      </div>

      {!isAvailable && validationError && (
        <p className="mt-3 rounded-lg border border-amber-300/12 bg-amber-300/5 px-3 py-2.5 text-xs leading-5 text-amber-100/80">
          {validationError}
        </p>
      )}

      {isEnabled && qualityWarning && (
        <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2.5 text-xs leading-5 text-amber-100/80">
          {qualityWarning}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-600">
        A stale or missing person mask safely falls back to the live camera frame. Keep the camera stationary.
      </p>
    </section>
  )
}
