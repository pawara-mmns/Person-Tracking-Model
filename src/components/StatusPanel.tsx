import type { ReactNode } from 'react'
import type { CameraStatus } from '../types/camera'
import type { CanvasStatus, RenderMetrics } from '../types/canvas'
import type {
  FingerState,
  GestureHandedness,
  HandGestureMap,
} from '../types/gesture'
import type { HandTrackingStatus } from '../types/handTracking'
import type { SegmentationStatus } from '../types/segmentation'
import { formatGestureName } from '../utils/gestureRecognition'

interface StatusPanelProps {
  cameraStatus: CameraStatus
  canvasStatus: CanvasStatus
  metrics: RenderMetrics
  handTrackingStatus: HandTrackingStatus
  handsDetected: number
  aiFps: number
  gestures: HandGestureMap
  showGestureDebug: boolean
  segmentationStatus: SegmentationStatus
  segmentationFps: number
  averagePersonConfidence: number
  personCoverage: number
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

const HAND_TRACKING_LABELS: Record<HandTrackingStatus, string> = {
  loading: 'Loading',
  ready: 'Ready',
  active: 'Active',
  error: 'Error',
}

const SEGMENTATION_LABELS: Record<SegmentationStatus, string> = {
  loading: 'Loading',
  ready: 'Ready',
  active: 'Active',
  error: 'Error',
}

function StatusValue({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span className={active ? 'font-medium text-emerald-300' : 'font-medium text-zinc-300'}>
      {children}
    </span>
  )
}

const FINGER_LABELS: Array<[keyof FingerState, string]> = [
  ['thumb', 'Thumb'],
  ['index', 'Index'],
  ['middle', 'Middle'],
  ['ring', 'Ring'],
  ['pinky', 'Pinky'],
]

function GestureCard({
  hand,
  gestureState,
  showDebug,
}: {
  hand: GestureHandedness
  gestureState: HandGestureMap[GestureHandedness]
  showDebug: boolean
}) {
  if (!gestureState) return null

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3.5 text-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {hand} hand
          </p>
          <p className="mt-1.5 text-sm font-semibold text-teal-200">
            {formatGestureName(gestureState.gesture)}
          </p>
        </div>
        <div className="text-right font-mono text-zinc-400">
          <p>{(gestureState.stableForMs / 1000).toFixed(1)}s stable</p>
          {gestureState.gesture !== 'UNKNOWN' && (
            <p className="mt-1 text-[10px] text-zinc-600">
              {Math.round(gestureState.confidence * 100)}% geometry
            </p>
          )}
        </div>
      </div>

      {showDebug && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-white/8 pt-3 sm:grid-cols-5">
          {FINGER_LABELS.map(([finger, label]) => (
            <div key={finger} className="flex items-center justify-between gap-2 sm:block">
              <span className="text-zinc-600">{label}</span>
              <span
                className={`font-mono sm:mt-1 sm:block ${
                  gestureState.fingers[finger] ? 'text-emerald-300' : 'text-zinc-400'
                }`}
              >
                {gestureState.fingers[finger] ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StatusPanel({
  cameraStatus,
  canvasStatus,
  metrics,
  handTrackingStatus,
  handsDetected,
  aiFps,
  gestures,
  showGestureDebug,
  segmentationStatus,
  segmentationFps,
  averagePersonConfidence,
  personCoverage,
}: StatusPanelProps) {
  const isRendering = canvasStatus === 'rendering'
  const isHandTracking = handTrackingStatus === 'active'
  const isSegmenting = segmentationStatus === 'active'

  return (
    <div className="mt-4">
      <div className="grid gap-x-6 gap-y-4 rounded-xl border border-white/8 bg-white/3 px-4 py-4 text-xs sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
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
        <span className="text-zinc-500">Hand AI</span>
        <div className="lg:mt-1.5">
          <StatusValue active={handTrackingStatus === 'ready' || isHandTracking}>
            {HAND_TRACKING_LABELS[handTrackingStatus]}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Hands detected</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={handsDetected > 0}>{handsDetected}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Render rate</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={isRendering}>{isRendering ? `${metrics.fps} FPS` : '-- FPS'}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">AI rate</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={isHandTracking}>{isHandTracking ? `${aiFps} FPS` : '-- FPS'}</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Person segmentation</span>
        <div className="lg:mt-1.5">
          <StatusValue active={segmentationStatus === 'ready' || isSegmenting}>
            {SEGMENTATION_LABELS[segmentationStatus]}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Gesture system</span>
        <div className="lg:mt-1.5">
          <StatusValue active={handTrackingStatus === 'ready' || isHandTracking}>
            {handTrackingStatus === 'error'
              ? 'Unavailable'
              : handTrackingStatus === 'loading'
                ? 'Loading'
                : handTrackingStatus === 'ready'
                  ? 'Ready'
                  : 'Active'}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Segmentation rate</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={isSegmenting}>
            {isSegmenting ? `${segmentationFps} FPS` : '-- FPS'}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Person confidence</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={averagePersonConfidence > 0}>
            {isSegmenting ? `${Math.round(averagePersonConfidence * 100)}%` : '--'}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Mask coverage</span>
        <div className="font-mono lg:mt-1.5">
          <StatusValue active={personCoverage > 0}>
            {isSegmenting ? `${Math.round(personCoverage * 100)}%` : '--'}
          </StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Background capture</span>
        <div className="lg:mt-1.5">
          <StatusValue>Not enabled</StatusValue>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 lg:block">
        <span className="text-zinc-500">Invisible mode</span>
        <div className="lg:mt-1.5">
          <StatusValue>Not enabled</StatusValue>
        </div>
      </div>
      </div>

      {(gestures.Left || gestures.Right) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <GestureCard hand="Left" gestureState={gestures.Left} showDebug={showGestureDebug} />
          <GestureCard hand="Right" gestureState={gestures.Right} showDebug={showGestureDebug} />
        </div>
      )}
    </div>
  )
}
