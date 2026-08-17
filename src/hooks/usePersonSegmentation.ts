import { useCallback, useEffect, useRef, useState } from 'react'
import { SEGMENTATION_CONFIG } from '../config/segmentationConfig'
import {
  resetPersonSegmentationWorker,
  sendPersonSegmentationFrame,
  subscribeToPersonSegmentationWorker,
} from '../services/personSegmentationWorker'
import type {
  PersonSegmentationMask,
  PersonSegmentationState,
  SegmentationDebugMode,
  SegmentationWorkerResponse,
} from '../types/segmentation'

interface UsePersonSegmentationOptions {
  isCameraActive: boolean
}

const INITIAL_STATE: PersonSegmentationState = {
  status: 'loading',
  segmentationFps: 0,
  averagePersonConfidence: 0,
  personCoverage: 0,
  error: null,
}

export function usePersonSegmentation({
  isCameraActive,
}: UsePersonSegmentationOptions) {
  const [segmentationState, setSegmentationState] =
    useState<PersonSegmentationState>(INITIAL_STATE)
  const [debugMode, setDebugModeState] =
    useState<SegmentationDebugMode>('overlay')
  const latestMaskRef = useRef<PersonSegmentationMask | null>(null)
  const debugModeRef = useRef<SegmentationDebugMode>('overlay')
  const cameraActiveRef = useRef(isCameraActive)
  const modelReadyRef = useRef(false)
  const modelFailedRef = useRef(false)
  const inferenceInFlightRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const lastInferenceRequestRef = useRef(-Infinity)
  const sessionIdRef = useRef(0)
  const maskVersionRef = useRef(0)
  const framesInSampleRef = useRef(0)
  const sampleStartedAtRef = useRef(performance.now())

  useEffect(() => {
    const handleWorkerMessage = (message: SegmentationWorkerResponse) => {
      switch (message.type) {
        case 'MODEL_READY':
          modelReadyRef.current = true
          modelFailedRef.current = false
          setSegmentationState({
            status: 'ready',
            segmentationFps: 0,
            averagePersonConfidence: 0,
            personCoverage: 0,
            error: null,
          })
          break

        case 'MODEL_ERROR':
          modelReadyRef.current = false
          modelFailedRef.current = true
          inferenceInFlightRef.current = false
          latestMaskRef.current = null
          console.error('Unable to load person segmentation model:', message.error)
          setSegmentationState({
            status: 'error',
            segmentationFps: 0,
            averagePersonConfidence: 0,
            personCoverage: 0,
            error: 'Unable to initialize person segmentation.',
          })
          break

        case 'SEGMENTATION_RESULT': {
          inferenceInFlightRef.current = false
          if (
            !cameraActiveRef.current ||
            message.sessionId !== sessionIdRef.current
          ) {
            break
          }

          maskVersionRef.current += 1
          latestMaskRef.current = {
            data: message.mask,
            width: message.width,
            height: message.height,
            timestampMs: message.timestampMs,
            version: maskVersionRef.current,
          }
          framesInSampleRef.current += 1

          const now = performance.now()
          const sampleDuration = now - sampleStartedAtRef.current
          if (sampleDuration >= SEGMENTATION_CONFIG.metricsSampleIntervalMs) {
            const segmentationFps = Math.round(
              (framesInSampleRef.current * 1000) / sampleDuration,
            )
            framesInSampleRef.current = 0
            sampleStartedAtRef.current = now
            setSegmentationState({
              status: 'active',
              segmentationFps,
              averagePersonConfidence: message.averagePersonConfidence,
              personCoverage: message.personCoverage,
              error: null,
            })
          } else {
            setSegmentationState((currentState) =>
              currentState.status === 'active' && currentState.error === null
                ? currentState
                : {
                    ...currentState,
                    status: 'active',
                    averagePersonConfidence: message.averagePersonConfidence,
                    personCoverage: message.personCoverage,
                    error: null,
                  },
            )
          }
          break
        }

        case 'SEGMENTATION_ERROR':
          inferenceInFlightRef.current = false
          if (message.sessionId !== sessionIdRef.current) break
          latestMaskRef.current = null
          console.error('Person segmentation inference failed:', message.error)
          setSegmentationState((currentState) => ({
            ...currentState,
            status: 'error',
            segmentationFps: 0,
            error: 'Person segmentation temporarily failed. Retrying...',
          }))
          break

        case 'DISPOSED':
          break
      }
    }

    return subscribeToPersonSegmentationWorker(handleWorkerMessage)
  }, [])

  useEffect(() => {
    cameraActiveRef.current = isCameraActive
    sessionIdRef.current += 1
    inferenceInFlightRef.current = false
    latestMaskRef.current = null
    lastVideoTimeRef.current = -1
    lastInferenceRequestRef.current = -Infinity
    framesInSampleRef.current = 0
    sampleStartedAtRef.current = performance.now()
    resetPersonSegmentationWorker()

    setSegmentationState((currentState) => ({
      status: modelFailedRef.current
        ? 'error'
        : modelReadyRef.current
          ? 'ready'
          : 'loading',
      segmentationFps: 0,
      averagePersonConfidence: 0,
      personCoverage: 0,
      error: modelFailedRef.current ? currentState.error : null,
    }))
  }, [isCameraActive])

  const processVideoFrame = useCallback(
    (video: HTMLVideoElement, timestamp: number) => {
      const inferenceInterval = 1000 / SEGMENTATION_CONFIG.targetFps
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
        return
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

          const wasSent = sendPersonSegmentationFrame({
            type: 'SEGMENT_FRAME',
            bitmap,
            timestampMs: timestamp,
            sessionId,
          })
          if (!wasSent) inferenceInFlightRef.current = false
        })
        .catch((error: unknown) => {
          inferenceInFlightRef.current = false
          latestMaskRef.current = null
          console.error('Unable to capture a segmentation frame:', error)
          setSegmentationState((currentState) => ({
            ...currentState,
            status: 'error',
            segmentationFps: 0,
            error: 'This browser could not prepare a person segmentation frame.',
          }))
        })
    },
    [],
  )

  const setDebugMode = useCallback((mode: SegmentationDebugMode) => {
    debugModeRef.current = mode
    setDebugModeState(mode)
  }, [])

  return {
    ...segmentationState,
    debugMode,
    debugModeRef,
    latestMaskRef,
    processVideoFrame,
    setDebugMode,
  }
}

