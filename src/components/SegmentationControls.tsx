import type { SegmentationDebugMode } from '../types/segmentation'

interface SegmentationControlsProps {
  mode: SegmentationDebugMode
  disabled: boolean
  onModeChange: (mode: SegmentationDebugMode) => void
}

function DebugButton({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={`size-1.5 rounded-full ${active ? 'bg-teal-300' : 'bg-zinc-600'}`} />
      {label}: {active ? 'On' : 'Off'}
    </button>
  )
}

export function SegmentationControls({
  mode,
  disabled,
  onModeChange,
}: SegmentationControlsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <DebugButton
        active={mode === 'overlay'}
        disabled={disabled}
        label="Segmentation overlay"
        onClick={() => onModeChange(mode === 'overlay' ? 'off' : 'overlay')}
      />
      <DebugButton
        active={mode === 'mask'}
        disabled={disabled}
        label="Mask view"
        onClick={() => onModeChange(mode === 'mask' ? 'off' : 'mask')}
      />
    </div>
  )
}

