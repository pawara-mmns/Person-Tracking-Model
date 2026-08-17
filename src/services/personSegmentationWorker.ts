import type {
  SegmentationWorkerRequest,
  SegmentationWorkerResponse,
} from '../types/segmentation'

type WorkerSubscriber = (message: SegmentationWorkerResponse) => void

let worker: Worker | null = null
let consumerCount = 0
let teardownTimer: ReturnType<typeof setTimeout> | null = null
const subscribers = new Set<WorkerSubscriber>()

function createPersonSegmentationWorker() {
  const instance = new Worker(
    new URL('../workers/personSegmenter.worker.ts', import.meta.url),
    {
      type: 'module',
      name: 'person-segmenter',
    },
  )

  instance.onmessage = (event: MessageEvent<SegmentationWorkerResponse>) => {
    if (event.data.type === 'DISPOSED') {
      instance.terminate()
      return
    }
    subscribers.forEach((subscriber) => subscriber(event.data))
  }

  instance.onerror = (event) => {
    const message: SegmentationWorkerResponse = {
      type: 'MODEL_ERROR',
      error: event.message || 'The person segmentation worker failed to start.',
    }
    subscribers.forEach((subscriber) => subscriber(message))
  }

  return instance
}

export function subscribeToPersonSegmentationWorker(subscriber: WorkerSubscriber) {
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer)
    teardownTimer = null
  }

  consumerCount += 1
  subscribers.add(subscriber)
  worker ??= createPersonSegmentationWorker()

  let released = false
  return () => {
    if (released) return
    released = true
    subscribers.delete(subscriber)
    consumerCount = Math.max(0, consumerCount - 1)

    if (consumerCount === 0) {
      teardownTimer = setTimeout(() => {
        teardownTimer = null
        if (consumerCount > 0 || !worker) return

        const retiringWorker = worker
        worker = null
        retiringWorker.postMessage({ type: 'DISPOSE' } satisfies SegmentationWorkerRequest)
        setTimeout(() => retiringWorker.terminate(), 250)
      }, 0)
    }
  }
}

export function sendPersonSegmentationFrame(
  message: Extract<SegmentationWorkerRequest, { type: 'SEGMENT_FRAME' }>,
) {
  if (!worker) {
    message.bitmap.close()
    return false
  }

  worker.postMessage(message, [message.bitmap])
  return true
}

export function resetPersonSegmentationWorker() {
  worker?.postMessage({ type: 'RESET' } satisfies SegmentationWorkerRequest)
}

