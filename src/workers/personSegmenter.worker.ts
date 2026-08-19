/// <reference lib="webworker" />

import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from '@mediapipe/tasks-vision'
import moduleLoaderUrl from '../assets/mediapipe/wasm/vision_wasm_module_internal.js?url'
import moduleBinaryUrl from '../assets/mediapipe/wasm/vision_wasm_module_internal.wasm?url'
import { SEGMENTATION_CONFIG } from '../config/segmentationConfig'
import type {
  SegmentationWorkerRequest,
  SegmentationWorkerResponse,
} from '../types/segmentation'
import { processPersonConfidenceMask } from '../utils/processPersonMask'

const workerScope = self as unknown as DedicatedWorkerGlobalScope
let imageSegmenter: ImageSegmenter | null = null
let reusableConfidenceBuffer: Float32Array | null = null

function postResponse(message: SegmentationWorkerResponse, transfer?: Transferable[]) {
  workerScope.postMessage(message, transfer ?? [])
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown person segmentation error'
}

async function resolveLocalVisionFileset() {
  const selectedFileset = await FilesetResolver.forVisionTasks('', true)
  return {
    ...selectedFileset,
    wasmLoaderPath: moduleLoaderUrl,
    wasmBinaryPath: moduleBinaryUrl,
  }
}

function createPersonMask(result: ImageSegmenterResult) {
  const confidenceMask = result.confidenceMasks?.[0]
  if (!confidenceMask) {
    throw new Error('The segmentation model returned no person confidence mask.')
  }

  const currentMask = confidenceMask.getAsFloat32Array()
  const { width, height } = confidenceMask
  if (width <= 0 || height <= 0 || currentMask.length !== width * height) {
    throw new Error('The segmentation model returned an invalid mask.')
  }

  const processedMask = processPersonConfidenceMask(
    currentMask,
    reusableConfidenceBuffer,
  )
  reusableConfidenceBuffer = processedMask.confidenceBuffer

  return {
    mask: processedMask.mask,
    width,
    height,
    averagePersonConfidence: processedMask.averagePersonConfidence,
    personCoverage: processedMask.personCoverage,
  }
}

async function initializeImageSegmenter() {
  try {
    const vision = await resolveLocalVisionFileset()
    imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: SEGMENTATION_CONFIG.modelAssetPath,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
    postResponse({ type: 'MODEL_READY' })
  } catch (error) {
    console.error('Unable to initialize MediaPipe Image Segmenter:', error)
    postResponse({ type: 'MODEL_ERROR', error: getErrorMessage(error) })
  }
}

function segmentFrame(
  bitmap: ImageBitmap,
  timestampMs: number,
  sessionId: number,
) {
  try {
    if (!imageSegmenter) throw new Error('Person segmentation model is not ready.')

    imageSegmenter.segmentForVideo(bitmap, timestampMs, (result) => {
      try {
        const personMask = createPersonMask(result)
        postResponse(
          {
            type: 'SEGMENTATION_RESULT',
            ...personMask,
            timestampMs,
            sessionId,
          },
          [personMask.mask.buffer],
        )
      } catch (error) {
        console.error('Unable to process the person segmentation mask:', error)
        postResponse({
          type: 'SEGMENTATION_ERROR',
          error: getErrorMessage(error),
          sessionId,
        })
      } finally {
        result.close()
      }
    })
  } catch (error) {
    console.error('MediaPipe person segmentation failed:', error)
    postResponse({
      type: 'SEGMENTATION_ERROR',
      error: getErrorMessage(error),
      sessionId,
    })
  } finally {
    bitmap.close()
  }
}

workerScope.onmessage = (event: MessageEvent<SegmentationWorkerRequest>) => {
  const message = event.data

  if (message.type === 'DISPOSE') {
    imageSegmenter?.close()
    imageSegmenter = null
    reusableConfidenceBuffer = null
    postResponse({ type: 'DISPOSED' })
    workerScope.close()
    return
  }

  if (message.type === 'RESET') {
    reusableConfidenceBuffer = null
    return
  }

  segmentFrame(message.bitmap, message.timestampMs, message.sessionId)
}

void initializeImageSegmenter()

export {}
