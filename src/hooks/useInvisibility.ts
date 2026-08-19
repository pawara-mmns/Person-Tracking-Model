import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { INVISIBILITY_CONFIG } from '../config/invisibilityConfig'
import type { BackgroundCaptureStatus } from '../types/background'
import type { CanvasStatus } from '../types/canvas'
import type {
  InvisibilityRenderState,
  InvisibilityRuntimeStatus,
  InvisibilityState,
  InvisibilityStatus,
  InvisibilityDebugView,
} from '../types/invisibility'
import type { SegmentationStatus } from '../types/segmentation'

interface UseInvisibilityOptions {
  isCameraActive: boolean
  canvasStatus: CanvasStatus
  segmentationStatus: SegmentationStatus
  backgroundStatus: BackgroundCaptureStatus
  backgroundWidth: number | null
  backgroundHeight: number | null
  backgroundCapturedAt: number | null
  processingWidth: number
  processingHeight: number
  renderStateRef: RefObject<InvisibilityRenderState>
  runtimeStatusRef: RefObject<InvisibilityRuntimeStatus>
}

export function useInvisibility({
  isCameraActive,
  canvasStatus,
  segmentationStatus,
  backgroundStatus,
  backgroundWidth,
  backgroundHeight,
  backgroundCapturedAt,
  processingWidth,
  processingHeight,
  renderStateRef,
  runtimeStatusRef,
}: UseInvisibilityOptions) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [showOriginalFrame, setShowOriginalFrame] = useState(false)
  const [showHandOverlay, setShowHandOverlay] = useState(true)
  const [featheringEnabled, setFeatheringEnabled] = useState(true)
  const [temporalSmoothingEnabled, setTemporalSmoothingEnabled] = useState(true)
  const [colorMatchingEnabled, setColorMatchingEnabled] = useState(true)
  const [debugView, setDebugView] = useState<InvisibilityDebugView>('final')
  const [runtimeStatus, setRuntimeStatus] = useState<InvisibilityRuntimeStatus>(
    runtimeStatusRef.current,
  )

  const resolutionMatches =
    backgroundWidth !== null &&
    backgroundHeight !== null &&
    backgroundWidth === processingWidth &&
    backgroundHeight === processingHeight
  const isAvailable =
    isCameraActive &&
    canvasStatus === 'rendering' &&
    segmentationStatus === 'active' &&
    backgroundStatus === 'captured' &&
    resolutionMatches

  let validationError: string | null = null
  if (!isCameraActive || canvasStatus !== 'rendering') {
    validationError = 'Start the camera before enabling Invisible Mode.'
  } else if (backgroundStatus === 'incompatible' || !resolutionMatches) {
    validationError =
      backgroundWidth === null || backgroundHeight === null
        ? 'Capture a clean background first.'
        : 'Background no longer matches the camera resolution. Please capture a new background.'
  } else if (backgroundStatus !== 'captured') {
    validationError = 'Capture a clean background first.'
  } else if (segmentationStatus !== 'active') {
    validationError = 'Person segmentation must be active.'
  }

  useEffect(() => {
    if (!isAvailable) {
      setIsEnabled(false)
      setShowOriginalFrame(false)
    }
  }, [isAvailable])

  useEffect(() => {
    if (!isEnabled) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const sampleStatus = () => {
      if (disposed) return
      setRuntimeStatus({ ...runtimeStatusRef.current })
      timer = setTimeout(sampleStatus, 500)
    }
    sampleStatus()
    return () => {
      disposed = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [isEnabled, runtimeStatusRef])

  const enableInvisible = useCallback(() => {
    if (isAvailable) setIsEnabled(true)
  }, [isAvailable])

  const disableInvisible = useCallback(() => {
    setIsEnabled(false)
    setShowOriginalFrame(false)
  }, [])

  const toggleInvisible = useCallback(() => {
    if (!isAvailable) return
    setIsEnabled((current) => !current)
    setShowOriginalFrame(false)
  }, [isAvailable])

  const status: InvisibilityStatus = isEnabled
    ? 'active'
    : isAvailable
      ? 'ready'
      : 'unavailable'

  useEffect(() => {
    renderStateRef.current = {
      enabled: isEnabled && isAvailable && !showOriginalFrame,
      showHandOverlay,
      backgroundVersion: backgroundCapturedAt,
      quality: {
        featheringEnabled,
        temporalSmoothingEnabled,
        colorMatchingEnabled,
        debugView,
      },
    }
  }, [
    backgroundCapturedAt,
    colorMatchingEnabled,
    debugView,
    featheringEnabled,
    isAvailable,
    isEnabled,
    renderStateRef,
    showHandOverlay,
    showOriginalFrame,
    temporalSmoothingEnabled,
  ])

  const qualityWarning =
    isEnabled &&
    !showOriginalFrame &&
    runtimeStatus.colorMismatch >=
      INVISIBILITY_CONFIG.colorMismatchWarningThreshold
      ? 'Scene lighting has changed. Consider recapturing the background.'
      : null
  const maskQualityStable =
    runtimeStatus.maskFresh &&
    runtimeStatus.maskMotion < INVISIBILITY_CONFIG.fastMotionChangeHigh

  const state: InvisibilityState = {
    status,
    isEnabled,
    showOriginalFrame,
    showHandOverlay,
    validationError,
    qualityWarning,
  }

  return {
    ...state,
    isAvailable,
    enableInvisible,
    disableInvisible,
    toggleInvisible,
    setShowOriginalFrame,
    setShowHandOverlay,
    featheringEnabled,
    temporalSmoothingEnabled,
    colorMatchingEnabled,
    debugView,
    runtimeStatus,
    maskQualityStable,
    setFeatheringEnabled,
    setTemporalSmoothingEnabled,
    setColorMatchingEnabled,
    setDebugView,
  }
}
