import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraState } from '../types/camera'

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
  audio: false,
}

function getCameraError(error: unknown): Pick<CameraState, 'status' | 'error'> {
  const errorName = error instanceof DOMException ? error.name : ''

  switch (errorName) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        status: 'permission-denied',
        error: 'Camera permission was denied. Allow camera access in your browser settings and try again.',
      }
    case 'NotFoundError':
      return {
        status: 'error',
        error: 'No camera was detected on this device.',
      }
    case 'NotReadableError':
    case 'AbortError':
      return {
        status: 'error',
        error: 'The camera may already be in use by another application.',
      }
    case 'OverconstrainedError':
      return {
        status: 'error',
        error: 'This camera does not support the requested video settings.',
      }
    default:
      return {
        status: 'error',
        error: 'The camera could not be started. Check your browser and device settings, then try again.',
      }
  }
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useCamera() {
  const [cameraState, setCameraState] = useState<CameraState>({
    stream: null,
    status: 'ready',
    error: null,
  })
  const streamRef = useRef<MediaStream | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1
    stopStream(streamRef.current)
    streamRef.current = null

    if (mountedRef.current) {
      setCameraState({ stream: null, status: 'stopped', error: null })
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (streamRef.current) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setCameraState({ stream: null, status: 'starting', error: null })

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState({
        stream: null,
        status: 'error',
        error: 'Camera access is not supported in this browser or context. Use a modern browser on HTTPS or localhost.',
      })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)

      // A permission prompt can resolve after Stop was pressed or the page unmounted.
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stopStream(stream)
        return
      }

      streamRef.current = stream
      setCameraState({ stream, status: 'active', error: null })
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setCameraState({ stream: null, ...getCameraError(error) })
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  return {
    ...cameraState,
    startCamera,
    stopCamera,
  }
}
