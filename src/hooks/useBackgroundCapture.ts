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

interface UseBackgroundCaptureOptions {
  videoRef: RefObject<HTMLVideoElement | null>
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
}

export function useBackgroundCapture({
  videoRef,
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
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef(captureState)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const clearStoredCanvas = useCallback(() => {
    const canvas = backgroundCanvasRef.current
    if (!canvas) return
    canvas.width = 1
    canvas.height = 1
  }, [])

  const cancelCapture = useCallback(() => {
    const isPending =
      stateRef.current.status === 'countdown' ||
      stateRef.current.status === 'validating'
    if (!isPending) return

    clearTimer()
    setCaptureState({
      status: 'not-captured',
      countdown: null,
      metadata: null,
      message: 'Background capture cancelled.',
    })
  }, [clearTimer, setCaptureState])

  const clearBackground = useCallback(() => {
    clearTimer()
    clearStoredCanvas()
    setCaptureState(INITIAL_STATE)
  }, [clearStoredCanvas, clearTimer, setCaptureState])

  const failCapture = useCallback(
    (message: string) => {
      clearTimer()
      clearStoredCanvas()
      setCaptureState({
        status: 'failed',
        countdown: null,
        metadata: null,
        message,
      })
    },
    [clearStoredCanvas, clearTimer, setCaptureState],
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
    let remaining = BACKGROUND_CAPTURE_CONFIG.countdownSeconds
    setCaptureState({
      status: 'countdown',
      countdown: remaining,
      metadata: null,
      message: 'Please move completely out of the camera frame.',
    })

    const finishCapture = () => {
      timerRef.current = null
      if (
        !cameraActiveRef.current ||
        canvasStatusRef.current !== 'rendering'
      ) {
        failCapture('Background capture was cancelled because the camera stopped.')
        return
      }
      if (segmentationStatusRef.current !== 'active') {
        failCapture('Background capture requires active person segmentation.')
        return
      }

      const activeVideo = videoRef.current
      const latestMask = latestMaskRef.current
      const now = performance.now()
      if (
        !activeVideo ||
        activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        activeVideo.videoWidth <= 0 ||
        activeVideo.videoHeight <= 0 ||
        !latestMask ||
        now - latestMask.timestampMs >
          BACKGROUND_CAPTURE_CONFIG.maximumSampleAgeMs
      ) {
        failCapture('A recent segmentation mask is unavailable. Please try again.')
        return
      }

      const validation = validateBackgroundScene(
        coverageHistoryRef.current,
        now,
      )
      const latestCoverage = calculatePersonCoverage(latestMask)
      if (
        !validation.sceneClear ||
        latestCoverage > BACKGROUND_CAPTURE_CONFIG.personCoverageThreshold
      ) {
        failCapture(
          'Background capture failed. Person detected in frame—move completely out and try again.',
        )
        return
      }

      const width = activeVideo.videoWidth
      const height = activeVideo.videoHeight
      const backgroundCanvas =
        backgroundCanvasRef.current ?? document.createElement('canvas')
      const context = backgroundCanvas.getContext('2d', { alpha: false })
      if (!context) {
        failCapture('The browser could not create the background capture canvas.')
        return
      }

      backgroundCanvas.width = width
      backgroundCanvas.height = height
      context.drawImage(activeVideo, 0, 0, width, height)
      backgroundCanvasRef.current = backgroundCanvas
      setCaptureState({
        status: 'captured',
        countdown: null,
        metadata: {
          width,
          height,
          capturedAt: Date.now(),
        },
        message: 'Background captured successfully.',
      })
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
        })
        timerRef.current = setTimeout(advanceCountdown, 1000)
        return
      }

      setCaptureState({
        status: 'validating',
        countdown: null,
        metadata: null,
        message: 'Capturing and validating the clean background...',
      })
      timerRef.current = setTimeout(
        finishCapture,
        BACKGROUND_CAPTURE_CONFIG.validationDelayMs,
      )
    }

    timerRef.current = setTimeout(advanceCountdown, 1000)
  }, [
    clearStoredCanvas,
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
      setCaptureState({
        status: 'not-captured',
        countdown: null,
        metadata: null,
        message: 'Background capture cancelled because the camera stopped.',
      })
    } else if (segmentationStatus === 'error') {
      failCapture('Background capture cancelled because segmentation is unavailable.')
    }
  }, [
    clearTimer,
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

  useEffect(() => () => clearTimer(), [clearTimer])

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
