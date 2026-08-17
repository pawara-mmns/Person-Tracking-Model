import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { BACKGROUND_CAPTURE_CONFIG } from '../config/backgroundCaptureConfig'
import type {
  BackgroundCaptureState,
  BackgroundCaptureStatus,
} from '../types/background'
import type { CanvasStatus } from '../types/canvas'
import type {
  PersonCoverageSample,
  PersonSegmentationMask,
  SegmentationStatus,
} from '../types/segmentation'
import {
  calculatePersonCoverage,
  validateBackgroundScene,
} from '../utils/backgroundValidation'
import { BackgroundPlateAccumulator } from '../utils/backgroundPlate'

interface UseBackgroundCaptureOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  backgroundCanvasRef: RefObject<HTMLCanvasElement | null>
  latestMaskRef: RefObject<PersonSegmentationMask | null>
  coverageHistoryRef: RefObject<PersonCoverageSample[]>
  isCameraActive: boolean
  canvasStatus: CanvasStatus
  segmentationStatus: SegmentationStatus
  activeWidth: number
  activeHeight: number
}

const INITIAL_STATE: BackgroundCaptureState = {
  status: 'not-captured',
  countdown: null,
  metadata: null,
  message: null,
  framesCaptured: 0,
  totalFrames: 0,
}

export function useBackgroundCapture({
  videoRef,
  backgroundCanvasRef,
  latestMaskRef,
  coverageHistoryRef,
  isCameraActive,
  canvasStatus,
  segmentationStatus,
  activeWidth,
  activeHeight,
}: UseBackgroundCaptureOptions) {
  const [captureState, setCaptureStateValue] =
    useState<BackgroundCaptureState>(INITIAL_STATE)
  const stateRef = useRef(captureState)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const plateAccumulatorRef = useRef(new BackgroundPlateAccumulator())
  const cameraActiveRef = useRef(isCameraActive)
  const canvasStatusRef = useRef(canvasStatus)
  const segmentationStatusRef = useRef(segmentationStatus)

  cameraActiveRef.current = isCameraActive
  canvasStatusRef.current = canvasStatus
  segmentationStatusRef.current = segmentationStatus

  const setCaptureState = useCallback((nextState: BackgroundCaptureState) => {
    stateRef.current = nextState
    setCaptureStateValue(nextState)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const clearWorkingBuffers = useCallback(() => {
    plateAccumulatorRef.current.clear()
    const canvas = captureCanvasRef.current
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
  }, [])

  const clearStoredCanvas = useCallback(() => {
    const canvas = backgroundCanvasRef.current
    if (!canvas) return
    canvas.width = 1
    canvas.height = 1
  }, [backgroundCanvasRef])

  const cancelCapture = useCallback(() => {
    const isPending =
      stateRef.current.status === 'countdown' ||
      stateRef.current.status === 'validating'
    if (!isPending) return
    clearTimer()
    clearWorkingBuffers()
    setCaptureState({
      ...INITIAL_STATE,
      message: 'Background capture cancelled.',
    })
  }, [clearTimer, clearWorkingBuffers, setCaptureState])

  const clearBackground = useCallback(() => {
    clearTimer()
    clearWorkingBuffers()
    clearStoredCanvas()
    setCaptureState(INITIAL_STATE)
  }, [clearStoredCanvas, clearTimer, clearWorkingBuffers, setCaptureState])

  const failCapture = useCallback(
    (message: string) => {
      clearTimer()
      clearWorkingBuffers()
      clearStoredCanvas()
      setCaptureState({
        ...INITIAL_STATE,
        status: 'failed',
        message,
      })
    },
    [clearStoredCanvas, clearTimer, clearWorkingBuffers, setCaptureState],
  )

  const startCapture = useCallback(() => {
    if (
      timerRef.current !== null ||
      !cameraActiveRef.current ||
      canvasStatusRef.current !== 'rendering' ||
      segmentationStatusRef.current !== 'active'
    ) {
      return
    }

    const video = videoRef.current
    if (
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      failCapture('The camera frame is not ready. Please try again.')
      return
    }

    clearStoredCanvas()
    clearWorkingBuffers()
    let remaining = BACKGROUND_CAPTURE_CONFIG.countdownSeconds
    setCaptureState({
      status: 'countdown',
      countdown: remaining,
      metadata: null,
      message: 'Please move completely out of the camera frame.',
      framesCaptured: 0,
      totalFrames: BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount,
    })

    const captureNextFrame = () => {
      timerRef.current = null
      const activeVideo = videoRef.current
      const latestMask = latestMaskRef.current
      const now = performance.now()
      const validation = validateBackgroundScene(coverageHistoryRef.current, now)
      if (
        !cameraActiveRef.current ||
        canvasStatusRef.current !== 'rendering' ||
        segmentationStatusRef.current !== 'active' ||
        !activeVideo ||
        activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        activeVideo.videoWidth <= 0 ||
        activeVideo.videoHeight <= 0 ||
        !latestMask ||
        now - latestMask.timestampMs >
          BACKGROUND_CAPTURE_CONFIG.maximumSampleAgeMs
      ) {
        failCapture('Background capture was interrupted because the camera or segmentation became unavailable.')
        return
      }
      if (
        !validation.sceneClear ||
        calculatePersonCoverage(latestMask) >
          BACKGROUND_CAPTURE_CONFIG.personCoverageThreshold
      ) {
        failCapture('Background capture interrupted. Person detected during capture.')
        return
      }

      const width = activeVideo.videoWidth
      const height = activeVideo.videoHeight
      const captureCanvas =
        captureCanvasRef.current ?? document.createElement('canvas')
      if (
        captureCanvas.width !== width ||
        captureCanvas.height !== height
      ) {
        captureCanvas.width = width
        captureCanvas.height = height
      }
      captureCanvasRef.current = captureCanvas
      const context = captureCanvas.getContext('2d', {
        alpha: false,
        willReadFrequently: true,
      })
      if (!context) {
        failCapture('The browser could not create the background averaging canvas.')
        return
      }

      try {
        context.drawImage(activeVideo, 0, 0, width, height)
        const frame = context.getImageData(0, 0, width, height).data
        plateAccumulatorRef.current.addFrame(frame, width, height)
      } catch (error) {
        console.error('Unable to accumulate a clean background frame:', error)
        failCapture('The browser could not read a camera frame for background averaging.')
        return
      }

      const framesCaptured = stateRef.current.framesCaptured + 1
      const totalFrames = BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount
      if (framesCaptured < totalFrames) {
        setCaptureState({
          status: 'validating',
          countdown: null,
          metadata: null,
          message: `Capturing clean background... ${framesCaptured} / ${totalFrames} frames`,
          framesCaptured,
          totalFrames,
        })
        timerRef.current = setTimeout(
          captureNextFrame,
          BACKGROUND_CAPTURE_CONFIG.backgroundFrameIntervalMs,
        )
        return
      }

      const backgroundCanvas =
        backgroundCanvasRef.current ?? document.createElement('canvas')
      try {
        plateAccumulatorRef.current.writeAverage(backgroundCanvas)
      } catch (error) {
        console.error('Unable to finalize the averaged background plate:', error)
        failCapture('The browser could not create the averaged background plate.')
        return
      }
      backgroundCanvasRef.current = backgroundCanvas
      clearWorkingBuffers()
      setCaptureState({
        status: 'captured',
        countdown: null,
        metadata: {
          width,
          height,
          capturedAt: Date.now(),
          frameCount: totalFrames,
        },
        message: `Background captured successfully from ${totalFrames} averaged frames.`,
        framesCaptured: totalFrames,
        totalFrames,
      })
    }

    const beginFrameCollection = () => {
      timerRef.current = null
      setCaptureState({
        status: 'validating',
        countdown: null,
        metadata: null,
        message: `Capturing clean background... 0 / ${BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount} frames`,
        framesCaptured: 0,
        totalFrames: BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount,
      })
      captureNextFrame()
    }

    const advanceCountdown = () => {
      timerRef.current = null
      if (!cameraActiveRef.current) {
        failCapture('Background capture was cancelled because the camera stopped.')
        return
      }
      if (segmentationStatusRef.current !== 'active') {
        failCapture('Background capture requires active person segmentation.')
        return
      }

      remaining -= 1
      if (remaining > 0) {
        setCaptureState({
          status: 'countdown',
          countdown: remaining,
          metadata: null,
          message: 'Please move completely out of the camera frame.',
          framesCaptured: 0,
          totalFrames: BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount,
        })
        timerRef.current = setTimeout(advanceCountdown, 1000)
        return
      }

      setCaptureState({
        status: 'validating',
        countdown: null,
        metadata: null,
        message: 'Waiting briefly for camera exposure to settle...',
        framesCaptured: 0,
        totalFrames: BACKGROUND_CAPTURE_CONFIG.backgroundFrameCount,
      })
      timerRef.current = setTimeout(
        beginFrameCollection,
        BACKGROUND_CAPTURE_CONFIG.exposureSettlingDelayMs,
      )
    }

    timerRef.current = setTimeout(advanceCountdown, 1000)
  }, [
    backgroundCanvasRef,
    clearStoredCanvas,
    clearWorkingBuffers,
    coverageHistoryRef,
    failCapture,
    latestMaskRef,
    setCaptureState,
    videoRef,
  ])

  useEffect(() => {
    const isPending =
      stateRef.current.status === 'countdown' ||
      stateRef.current.status === 'validating'
    if (!isPending) return

    if (!isCameraActive) {
      clearTimer()
      clearWorkingBuffers()
      setCaptureState({
        ...INITIAL_STATE,
        message: 'Background capture cancelled because the camera stopped.',
      })
    } else if (segmentationStatus === 'error') {
      failCapture('Background capture cancelled because segmentation is unavailable.')
    }
  }, [
    clearTimer,
    clearWorkingBuffers,
    failCapture,
    isCameraActive,
    segmentationStatus,
    setCaptureState,
  ])

  useEffect(() => {
    if (
      canvasStatus !== 'rendering' ||
      !captureState.metadata ||
      captureState.status === 'countdown' ||
      captureState.status === 'validating'
    ) {
      return
    }
    const resolutionMatches =
      captureState.metadata.width === activeWidth &&
      captureState.metadata.height === activeHeight
    const nextStatus: BackgroundCaptureStatus = resolutionMatches
      ? 'captured'
      : 'incompatible'
    if (nextStatus !== captureState.status) {
      setCaptureState({
        ...captureState,
        status: nextStatus,
        message: resolutionMatches
          ? 'Background captured successfully.'
          : 'Camera resolution changed. The background needs to be recaptured.',
      })
    }
  }, [
    activeHeight,
    activeWidth,
    canvasStatus,
    captureState,
    setCaptureState,
  ])

  useEffect(
    () => () => {
      clearTimer()
      clearWorkingBuffers()
    },
    [clearTimer, clearWorkingBuffers],
  )

  const validation = validateBackgroundScene(
    coverageHistoryRef.current,
    performance.now(),
  )
  const sceneClear =
    isCameraActive && segmentationStatus === 'active' && validation.sceneClear
  const isCapturing =
    captureState.status === 'countdown' || captureState.status === 'validating'
  const canCapture =
    isCameraActive &&
    canvasStatus === 'rendering' &&
    segmentationStatus === 'active' &&
    !isCapturing

  return {
    ...captureState,
    backgroundCanvasRef,
    backgroundReady: captureState.status === 'captured',
    canCapture,
    isCapturing,
    sceneClear,
    validationCoverage: validation.averageCoverage,
    startCapture,
    cancelCapture,
    clearBackground,
  }
}
