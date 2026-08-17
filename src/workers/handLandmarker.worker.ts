/// <reference lib="webworker" />

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { HAND_TRACKING_CONFIG } from '../config/handTracking'
import type { HandWorkerRequest, HandWorkerResponse } from '../types/handTracking'
import moduleLoaderUrl from '../assets/mediapipe/wasm/vision_wasm_module_internal.js?url'
import moduleBinaryUrl from '../assets/mediapipe/wasm/vision_wasm_module_internal.wasm?url'

const workerScope = self as unknown as DedicatedWorkerGlobalScope
let handLandmarker: HandLandmarker | null = null

function postResponse(message: HandWorkerResponse) {
  workerScope.postMessage(message)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown MediaPipe error'
}

async function resolveLocalVisionFileset() {
  // Module workers must use MediaPipe's ES-module loader. The classic loader
  // keeps ModuleFactory module-scoped when dynamically imported, so the Tasks
  // runtime cannot find it on the worker global.
  const selectedFileset = await FilesetResolver.forVisionTasks('', true)

  return {
    ...selectedFileset,
    wasmLoaderPath: moduleLoaderUrl,
    wasmBinaryPath: moduleBinaryUrl,
  }
}

async function initializeHandLandmarker() {
  try {
    const vision = await resolveLocalVisionFileset()

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_TRACKING_CONFIG.modelAssetPath,
      },
      runningMode: 'VIDEO',
      numHands: HAND_TRACKING_CONFIG.maxHands,
      minHandDetectionConfidence: HAND_TRACKING_CONFIG.detectionConfidence,
      minHandPresenceConfidence: HAND_TRACKING_CONFIG.presenceConfidence,
      minTrackingConfidence: HAND_TRACKING_CONFIG.trackingConfidence,
    })

    postResponse({
      type: 'MODEL_READY',
      connections: HandLandmarker.HAND_CONNECTIONS.map(({ start, end }) => ({ start, end })),
    })
  } catch (error) {
    console.error('Unable to initialize MediaPipe Hand Landmarker:', error)
    postResponse({ type: 'MODEL_ERROR', error: getErrorMessage(error) })
  }
}

workerScope.onmessage = (event: MessageEvent<HandWorkerRequest>) => {
  const message = event.data

  if (message.type === 'DISPOSE') {
    handLandmarker?.close()
    handLandmarker = null
    postResponse({ type: 'DISPOSED' })
    workerScope.close()
    return
  }

  const { bitmap, timestampMs, sessionId } = message

  try {
    if (!handLandmarker) {
      throw new Error('Hand Landmarker is not ready.')
    }

    const result = handLandmarker.detectForVideo(bitmap, timestampMs)
    postResponse({ type: 'DETECTION_RESULT', result, sessionId })
  } catch (error) {
    console.error('MediaPipe hand detection failed:', error)
    postResponse({
      type: 'DETECTION_ERROR',
      error: getErrorMessage(error),
      sessionId,
    })
  } finally {
    bitmap.close()
  }
}

void initializeHandLandmarker()

export {}
