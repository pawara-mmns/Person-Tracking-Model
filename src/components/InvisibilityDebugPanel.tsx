import { INVISIBILITY_CONFIG } from '../config/invisibilityConfig'
import type {
  InvisibilityDebugView,
  InvisibilityRuntimeStatus,
} from '../types/invisibility'

interface InvisibilityDebugPanelProps {
  debugView: InvisibilityDebugView
  rawMaskActive: boolean
  featheringEnabled: boolean
  temporalSmoothingEnabled: boolean
  colorMatchingEnabled: boolean
  runtimeStatus: InvisibilityRuntimeStatus
  backgroundFrames: number
  exposureControlSupported: boolean
  whiteBalanceControlSupported: boolean
  focusControlSupported: boolean
  qualityWarning: string | null
  onDebugViewChange: (view: InvisibilityDebugView) => void
  onRawMask: () => void
  onFeatheringChange: (enabled: boolean) => void
  onTemporalSmoothingChange: (enabled: boolean) => void
  onColorMatchingChange: (enabled: boolean) => void
}

function DebugToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs transition ${
        active
          ? 'border-emerald-300/20 bg-emerald-300/8 text-emerald-200'
          : 'border-white/8 bg-black/15 text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}: {active ? 'On' : 'Off'}
    </button>
  )
}

const VIEW_LABELS: Array<[InvisibilityDebugView, string]> = [
  ['final', 'Final composite'],
  ['processed-mask', 'Processed mask'],
  ['background-plate', 'Background plate'],
  ['split', 'Before | After'],
]

export function InvisibilityDebugPanel({
  debugView,
  rawMaskActive,
  featheringEnabled,
  temporalSmoothingEnabled,
  colorMatchingEnabled,
  runtimeStatus,
  backgroundFrames,
  exposureControlSupported,
  whiteBalanceControlSupported,
  focusControlSupported,
  qualityWarning,
  onDebugViewChange,
  onRawMask,
  onFeatheringChange,
  onTemporalSmoothingChange,
  onColorMatchingChange,
}: InvisibilityDebugPanelProps) {
  return (
    <details className="mt-3 rounded-xl border border-white/8 bg-white/2 px-4 py-3">
      <summary className="cursor-pointer text-xs font-medium text-zinc-400">
        Quality diagnostics and tuning
      </summary>

      <div className="mt-4 grid gap-4 border-t border-white/8 pt-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
            Debug view
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRawMask}
              className={`rounded-lg border px-3 py-2 text-xs ${
                rawMaskActive
                  ? 'border-teal-300/20 bg-teal-300/8 text-teal-200'
                  : 'border-white/8 bg-black/15 text-zinc-500'
              }`}
            >
              Raw confidence mask
            </button>
            {VIEW_LABELS.map(([view, label]) => (
              <button
                key={view}
                type="button"
                onClick={() => onDebugViewChange(view)}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  !rawMaskActive && debugView === view
                    ? 'border-teal-300/20 bg-teal-300/8 text-teal-200'
                    : 'border-white/8 bg-black/15 text-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <DebugToggle
            active={featheringEnabled}
            label="Mask feathering"
            onClick={() => onFeatheringChange(!featheringEnabled)}
          />
          <DebugToggle
            active={temporalSmoothingEnabled}
            label="Temporal smoothing"
            onClick={() =>
              onTemporalSmoothingChange(!temporalSmoothingEnabled)
            }
          />
          <DebugToggle
            active={colorMatchingEnabled}
            label="Color matching"
            onClick={() => onColorMatchingChange(!colorMatchingEnabled)}
          />
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <p className="rounded-lg bg-black/15 px-3 py-2 text-zinc-500">
            Mask: <span className="text-zinc-300">{runtimeStatus.maskFresh ? 'Fresh' : 'Waiting'}</span>
          </p>
          <p className="rounded-lg bg-black/15 px-3 py-2 text-zinc-500">
            Motion: <span className="font-mono text-zinc-300">{(runtimeStatus.maskMotion * 100).toFixed(1)}%</span>
          </p>
          <p className="rounded-lg bg-black/15 px-3 py-2 text-zinc-500">
            Color match: <span className="text-zinc-300">{runtimeStatus.colorMatchActive ? 'Active' : 'Idle'}</span>
          </p>
          <p className="rounded-lg bg-black/15 px-3 py-2 text-zinc-500">
            Background frames: <span className="font-mono text-zinc-300">{backgroundFrames || '--'}</span>
          </p>
        </div>

        {qualityWarning && (
          <p className="rounded-lg border border-amber-300/15 bg-amber-300/5 px-3 py-2.5 text-xs text-amber-100/80">
            {qualityWarning}
          </p>
        )}

        <div className="text-[11px] leading-5 text-zinc-600">
          <p>
            Defaults: threshold {INVISIBILITY_CONFIG.personThresholdLow.toFixed(2)}–{INVISIBILITY_CONFIG.personThresholdHigh.toFixed(2)}, dilation {INVISIBILITY_CONFIG.dilationRadiusPx}px, feather {INVISIBILITY_CONFIG.featherRadiusPx}px, smoothing {INVISIBILITY_CONFIG.temporalSmoothing.toFixed(2)}.
          </p>
          <p>
            Camera controls — exposure: {exposureControlSupported ? 'supported' : 'browser managed'}, white balance: {whiteBalanceControlSupported ? 'supported' : 'browser managed'}, focus: {focusControlSupported ? 'supported' : 'browser managed'}.
          </p>
        </div>
      </div>
    </details>
  )
}
