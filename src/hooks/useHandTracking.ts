import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { HAND_TRACKING_CONFIG } from '../config/handTracking'
import {
  sendHandTrackingFrame,
  subscribeToHandTrackingWorker,
} from '../services/handTrackingWorker'
import type {
  HandConnection,
  HandTrackingState,
  HandWorkerResponse,
} from '../types/handTracking'

interface UseHandTrackingOptions {
  isCameraActive: boolean
}

const INITIAL_STATE: HandTrackingState = {
  status: 'loading',
  handsDetected: 0,
  aiFps: 0,
  error: null,
}

export function useHandTracking({ isCameraActive }: UseHandTrackingOptions) {
  const [trackingState, setTrackingState] = useState<HandTrackingState>(INITIAL_STATE)
  const [debugOverlay, setDebugOverlayState] = useState(true)
  const latestResultRef = useRef<HandLandmarkerResult | null>(null)
  const handConnectionsRef = useRef<readonly HandConnection[]>([])
  const debugOverlayRef = useRef(true)
  const cameraActiveRef = useRef(isCameraActive)
  const modelReadyRef = useRef(false)
  const modelFailedRef = useRef(false)
  const detectionErrorActiveRef = useRef(false)
  const inferenceInFlightRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const lastInferenceRequestRef = useRef(-Infinity)
  const sessionIdRef = useRef(0)
  const aiFramesInSampleRef = useRef(0)
  const aiSampleStartedAtRef = useRef(performance.now())

  useEffect(() => {
    const handleWorkerMessage = (message: HandWorkerResponse) => {
      switch (message.type) {
        case 'MODEL_READY':
          modelReadyRef.current = true
          modelFailedRef.current = false
          handConnectionsRef.current = message.connections
          setTrackingState({
            status: cameraActiveRef.current ? 'active' : 'ready',
            handsDetected: 0,
            aiFps: 0,
            error: null,
          })
          break

        case 'MODEL_ERROR':
          modelReadyRef.current = false
          modelFailedRef.current = true
          inferenceInFlightRef.current = false
          latestResultRef.current = null
          console.error('Unable to load Hand Tracking model:', message.error)
          setTrackingState({
            status: 'error',
            handsDetected: 0,
            aiFps: 0,
            error: 'Unable to load the Hand Tracking model.',
          })
          break

        case 'DETECTION_RESULT': {
          inferenceInFlightRef.current = false
          if (
            !cameraActiveRef.current ||
            message.sessionId !== sessionIdRef.current
          ) {
            break
          }

          latestResultRef.current = message.result
          detectionErrorActiveRef.current = false
          aiFramesInSampleRef.current += 1

          const now = performance.now()
          const sampleDuration = now - aiSampleStartedAtRef.current
          const handsDetected = message.result.landmarks.length

          if (sampleDuration >= HAND_TRACKING_CONFIG.metricsSampleIntervalMs) {
            const aiFps = Math.round(
              (aiFramesInSampleRef.current * 1000) / sampleDuration,
            )
            aiFramesInSampleRef.current = 0
            aiSampleStartedAtRef.current = now
            setTrackingState({
              status: 'active',
              handsDetected,
              aiFps,
              error: null,
            })
          } else {
            setTrackingState((currentState) => {
              if (
                currentState.status === 'active' &&
                currentState.handsDetected === handsDetected &&
                currentState.error === null
              ) {
                return currentState
              }

              return {
                ...currentState,
                status: 'active',
                handsDetected,
                error: null,
              }
            })
          }
          break
        }

        case 'DETECTION_ERROR':
          inferenceInFlightRef.current = false
          if (message.sessionId !== sessionIdRef.current) break
          latestResultRef.current = null
          if (!detectionErrorActiveRef.current) {
            detectionErrorActiveRef.current = true
            console.error('Hand Tracking inference failed:', message.error)
            setTrackingState((currentState) => ({
              ...currentState,
              status: 'error',
              handsDetected: 0,
              error: 'Hand detection temporarily failed. Retrying...',
            }))
          }
          break

        case 'DISPOSED':
          break
      }
    }

    const unsubscribe = subscribeToHandTrackingWorker(handleWorkerMessage)
    return unsubscribe
  }, [])

  useEffect(() => {
    cameraActiveRef.current = isCameraActive
    sessionIdRef.current += 1
    latestResultRef.current = null
    lastVideoTimeRef.current = -1
    lastInferenceRequestRef.current = -Infinity
    aiFramesInSampleRef.current = 0
    aiSampleStartedAtRef.current = performance.now()
    detectionErrorActiveRef.current = false

    setTrackingState((currentState) => ({
      status: modelFailedRef.current
        ? 'error'
        : modelReadyRef.current && isCameraActive
          ? 'active'
          : modelReadyRef.current
            ? 'ready'
            : 'loading',
      handsDetected: 0,
      aiFps: 0,
      error: modelFailedRef.current ? currentState.error : null,
    }))
  }, [isCameraActive])

  const processVideoFrame = useCallback((video: HTMLVideoElement, timestamp: number) => {
    const latestResult = latestResultRef.current
    const inferenceInterval = 1000 / HAND_TRACKING_CONFIG.targetFps

    if (
      !cameraActiveRef.current ||
      !modelReadyRef.current ||
      inferenceInFlightRef.current ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0 ||
      video.currentTime === lastVideoTimeRef.current ||
      timestamp - lastInferenceRequestRef.current < inferenceInterval
    ) {
      return latestResult
    }

    inferenceInFlightRef.current = true
    lastVideoTimeRef.current = video.currentTime
    lastInferenceRequestRef.current = timestamp
    const sessionId = sessionIdRef.current

    void createImageBitmap(video)
      .then((bitmap) => {
        if (!cameraActiveRef.current || sessionId !== sessionIdRef.current) {
          bitmap.close()
          inferenceInFlightRef.current = false
          return
        }

        const wasSent = sendHandTrackingFrame({
          type: 'DETECT_FRAME',
          bitmap,
          timestampMs: timestamp,
          sessionId,
        })
        if (!wasSent) inferenceInFlightRef.current = false
      })
      .catch((error: unknown) => {
        inferenceInFlightRef.current = false
        if (!detectionErrorActiveRef.current) {
          detectionErrorActiveRef.current = true
          console.error('Unable to capture a frame for Hand Tracking:', error)
          setTrackingState((currentState) => ({
            ...currentState,
            status: 'error',
            handsDetected: 0,
            error: 'This browser could not prepare a frame for Hand Tracking.',
          }))
        }
      })

    return latestResult
  }, [])

  const setDebugOverlay = useCallback((enabled: boolean) => {
    debugOverlayRef.current = enabled
    setDebugOverlayState(enabled)
  }, [])

  return {
    ...trackingState,
    debugOverlay,
    debugOverlayRef,
    handConnectionsRef,
    processVideoFrame,
    setDebugOverlay,
  }
}
