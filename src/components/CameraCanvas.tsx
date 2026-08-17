import { useCallback, useRef } from 'react'
import { useCanvasRenderer } from '../hooks/useCanvasRenderer'
import { useHandTracking } from '../hooks/useHandTracking'
import { usePersonSegmentation } from '../hooks/usePersonSegmentation'
import { useBackgroundCapture } from '../hooks/useBackgroundCapture'
import { useInvisibility } from '../hooks/useInvisibility'
import { useCameraCapabilities } from '../hooks/useCameraCapabilities'
import type { CameraStatus } from '../types/camera'
import type { CanvasStatus } from '../types/canvas'
import type {
  InvisibilityRenderState,
  InvisibilityRuntimeStatus,
} from '../types/invisibility'
import { StatusPanel } from './StatusPanel'
import { SegmentationControls } from './SegmentationControls'
import { BackgroundCaptureControls } from './BackgroundCaptureControls'
import { InvisibilityControls } from './InvisibilityControls'
import { InvisibilityDebugPanel } from './InvisibilityDebugPanel'

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
  const cameraCapabilities = useCameraCapabilities(stream)
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const invisibilityRenderStateRef = useRef<InvisibilityRenderState>({
    enabled: false,
    showHandOverlay: true,
    backgroundVersion: null,
    quality: {
      featheringEnabled: true,
      temporalSmoothingEnabled: true,
      colorMatchingEnabled: true,
      debugView: 'final',
    },
  })
  const invisibilityRuntimeStatusRef = useRef<InvisibilityRuntimeStatus>({
    maskFresh: false,
    maskMotion: 0,
    colorMatchActive: false,
    colorMismatch: 0,
  })
  const handTracking = useHandTracking({
    isCameraActive: cameraStatus === 'active',
  })
  const personSegmentation = usePersonSegmentation({
    isCameraActive: cameraStatus === 'active',
  })
  const { videoRef, canvasRef, canvasStatus, metrics } = useCanvasRenderer({
    stream,
    isCameraActive: cameraStatus === 'active',
    processVideoFrame: handTracking.processVideoFrame,
    debugOverlayRef: handTracking.debugOverlayRef,
    handConnectionsRef: handTracking.handConnectionsRef,
    gesturesRef: handTracking.gesturesRef,
    processSegmentationFrame: personSegmentation.processVideoFrame,
    segmentationMaskRef: personSegmentation.latestMaskRef,
    segmentationDebugModeRef: personSegmentation.debugModeRef,
    backgroundCanvasRef,
    invisibilityRenderStateRef,
    invisibilityRuntimeStatusRef,
  })
  const backgroundCapture = useBackgroundCapture({
    videoRef,
    backgroundCanvasRef,
    latestMaskRef: personSegmentation.latestMaskRef,
    coverageHistoryRef: personSegmentation.coverageHistoryRef,
    isCameraActive: cameraStatus === 'active',
    canvasStatus,
    segmentationStatus: personSegmentation.status,
    activeWidth: metrics.width,
    activeHeight: metrics.height,
  })
  const invisibility = useInvisibility({
    isCameraActive: cameraStatus === 'active',
    canvasStatus,
    segmentationStatus: personSegmentation.status,
    backgroundStatus: backgroundCapture.status,
    backgroundWidth: backgroundCapture.metadata?.width ?? null,
    backgroundHeight: backgroundCapture.metadata?.height ?? null,
    backgroundCapturedAt: backgroundCapture.metadata?.capturedAt ?? null,
    processingWidth: metrics.width,
    processingHeight: metrics.height,
    renderStateRef: invisibilityRenderStateRef,
    runtimeStatusRef: invisibilityRuntimeStatusRef,
  })
  const handleToggleInvisible = useCallback(() => {
    if (!invisibility.isEnabled && invisibility.isAvailable) {
      personSegmentation.setDebugMode('off')
    }
    invisibility.toggleInvisible()
  }, [invisibility, personSegmentation])
  const handleCaptureBackground = useCallback(() => {
    invisibility.disableInvisible()
    backgroundCapture.startCapture()
  }, [backgroundCapture, invisibility])
  const handleClearBackground = useCallback(() => {
    invisibility.disableInvisible()
    backgroundCapture.clearBackground()
  }, [backgroundCapture, invisibility])
  const handleRawMaskDebug = useCallback(() => {
    invisibility.setDebugView('final')
    personSegmentation.setDebugMode('mask')
  }, [invisibility, personSegmentation])
  const handleInvisibilityDebugView = useCallback(
    (view: Parameters<typeof invisibility.setDebugView>[0]) => {
      personSegmentation.setDebugMode('off')
      invisibility.setDebugView(view)
    },
    [invisibility, personSegmentation],
  )
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
          <>
            <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Canvas live
              </div>
              <div className="rounded-full bg-black/55 px-3 py-1.5 font-mono text-[11px] font-medium text-zinc-100 backdrop-blur-md">
                {metrics.fps} FPS
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-medium text-zinc-200 backdrop-blur-md">
              <span
                className={`size-1.5 rounded-full ${
                  handTracking.status === 'error'
                    ? 'bg-rose-400'
                    : handTracking.status === 'loading'
                      ? 'animate-pulse bg-amber-400'
                      : 'bg-teal-300'
                }`}
              />
              {handTracking.status === 'loading'
                ? 'Loading Hand Tracking AI...'
                : handTracking.status === 'error'
                  ? 'Hand Tracking unavailable'
                  : `${handTracking.handsDetected} hand${handTracking.handsDetected === 1 ? '' : 's'} detected`}
            </div>
          </>
        )}
      </div>

      <StatusPanel
        cameraStatus={cameraStatus}
        canvasStatus={canvasStatus}
        metrics={metrics}
        handTrackingStatus={handTracking.status}
        handsDetected={handTracking.handsDetected}
        aiFps={handTracking.aiFps}
        gestures={handTracking.gestures}
        showGestureDebug={handTracking.debugOverlay}
        segmentationStatus={personSegmentation.status}
        segmentationFps={personSegmentation.segmentationFps}
        averagePersonConfidence={personSegmentation.averagePersonConfidence}
        personCoverage={personSegmentation.personCoverage}
        sceneClear={backgroundCapture.sceneClear}
        backgroundStatus={backgroundCapture.status}
        backgroundCountdown={backgroundCapture.countdown}
        invisibilityStatus={invisibility.status}
        maskQualityStable={
          invisibility.status === 'active' &&
          invisibility.maskQualityStable
        }
        colorMatchActive={
          invisibility.status === 'active' &&
          invisibility.runtimeStatus.colorMatchActive
        }
        temporalSmoothingActive={
          invisibility.status === 'active' &&
          invisibility.temporalSmoothingEnabled
        }
        backgroundFrames={backgroundCapture.metadata?.frameCount ?? 0}
      />

      <BackgroundCaptureControls
        status={backgroundCapture.status}
        countdown={backgroundCapture.countdown}
        metadata={backgroundCapture.metadata}
        message={backgroundCapture.message}
        framesCaptured={backgroundCapture.framesCaptured}
        totalFrames={backgroundCapture.totalFrames}
        backgroundCanvasRef={backgroundCapture.backgroundCanvasRef}
        sceneClear={backgroundCapture.sceneClear}
        personCoverage={personSegmentation.personCoverage}
        canCapture={backgroundCapture.canCapture}
        isCapturing={backgroundCapture.isCapturing}
        onCapture={handleCaptureBackground}
        onCancel={backgroundCapture.cancelCapture}
        onClear={handleClearBackground}
      />

      <InvisibilityControls
        status={invisibility.status}
        isAvailable={invisibility.isAvailable}
        isEnabled={invisibility.isEnabled}
        showOriginalFrame={invisibility.showOriginalFrame}
        showHandOverlay={invisibility.showHandOverlay}
        validationError={invisibility.validationError}
        qualityWarning={invisibility.qualityWarning}
        onToggleInvisible={handleToggleInvisible}
        onShowOriginalFrameChange={invisibility.setShowOriginalFrame}
        onShowHandOverlayChange={invisibility.setShowHandOverlay}
      />

      <InvisibilityDebugPanel
        debugView={invisibility.debugView}
        rawMaskActive={personSegmentation.debugMode === 'mask'}
        featheringEnabled={invisibility.featheringEnabled}
        temporalSmoothingEnabled={invisibility.temporalSmoothingEnabled}
        colorMatchingEnabled={invisibility.colorMatchingEnabled}
        runtimeStatus={invisibility.runtimeStatus}
        backgroundFrames={backgroundCapture.metadata?.frameCount ?? 0}
        exposureControlSupported={cameraCapabilities.exposureControl}
        whiteBalanceControlSupported={cameraCapabilities.whiteBalanceControl}
        focusControlSupported={cameraCapabilities.focusControl}
        qualityWarning={invisibility.qualityWarning}
        onDebugViewChange={handleInvisibilityDebugView}
        onRawMask={handleRawMaskDebug}
        onFeatheringChange={invisibility.setFeatheringEnabled}
        onTemporalSmoothingChange={invisibility.setTemporalSmoothingEnabled}
        onColorMatchingChange={invisibility.setColorMatchingEnabled}
      />

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs leading-5 text-zinc-600">
          AI runs locally in your browser. Camera frames are not uploaded.
        </p>
        <div className="flex flex-wrap gap-2">
          <SegmentationControls
            mode={personSegmentation.debugMode}
            disabled={personSegmentation.status === 'loading' || personSegmentation.status === 'error'}
            onModeChange={personSegmentation.setDebugMode}
          />
          <button
            type="button"
            aria-pressed={handTracking.debugOverlay}
            onClick={() => handTracking.setDebugOverlay(!handTracking.debugOverlay)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            <span
              className={`size-1.5 rounded-full ${handTracking.debugOverlay ? 'bg-teal-300' : 'bg-zinc-600'}`}
            />
            Finger debug: {handTracking.debugOverlay ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {handTracking.error && (
        <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/7 px-4 py-3 text-xs leading-5 text-rose-100" role="alert">
          {handTracking.error}
        </div>
      )}

      {personSegmentation.error && (
        <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-400/7 px-4 py-3 text-xs leading-5 text-rose-100" role="alert">
          {personSegmentation.error}
        </div>
      )}
    </>
  )
}
