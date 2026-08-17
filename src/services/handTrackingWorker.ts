import type { HandWorkerRequest, HandWorkerResponse } from '../types/handTracking'

type WorkerSubscriber = (message: HandWorkerResponse) => void

let worker: Worker | null = null
let consumerCount = 0
let teardownTimer: ReturnType<typeof setTimeout> | null = null
const subscribers = new Set<WorkerSubscriber>()

function createHandTrackingWorker() {
  const instance = new Worker(new URL('../workers/handLandmarker.worker.ts', import.meta.url), {
    type: 'module',
    name: 'hand-landmarker',
  })

  instance.onmessage = (event: MessageEvent<HandWorkerResponse>) => {
    if (event.data.type === 'DISPOSED') {
      instance.terminate()
      return
    }

    subscribers.forEach((subscriber) => subscriber(event.data))
  }

  instance.onerror = (event) => {
    const message: HandWorkerResponse = {
      type: 'MODEL_ERROR',
      error: event.message || 'The Hand Tracking worker failed to start.',
    }
    subscribers.forEach((subscriber) => subscriber(message))
  }

  return instance
}

export function subscribeToHandTrackingWorker(subscriber: WorkerSubscriber) {
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer)
    teardownTimer = null
  }

  consumerCount += 1
  subscribers.add(subscriber)
  worker ??= createHandTrackingWorker()

  let released = false

  return () => {
    if (released) return
    released = true
    subscribers.delete(subscriber)
    consumerCount = Math.max(0, consumerCount - 1)

    if (consumerCount === 0) {
      // A zero-delay grace period avoids duplicate model initialization in React Strict Mode.
      teardownTimer = setTimeout(() => {
        teardownTimer = null
        if (consumerCount > 0 || !worker) return

        const retiringWorker = worker
        worker = null
        retiringWorker.postMessage({ type: 'DISPOSE' } satisfies HandWorkerRequest)
        setTimeout(() => retiringWorker.terminate(), 250)
      }, 0)
    }
  }
}

export function sendHandTrackingFrame(
  message: Extract<HandWorkerRequest, { type: 'DETECT_FRAME' }>,
) {
  if (!worker) {
    message.bitmap.close()
    return false
  }

  worker.postMessage(message, [message.bitmap])
  return true
}
