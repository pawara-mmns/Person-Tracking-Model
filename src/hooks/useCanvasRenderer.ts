import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { CanvasStatus, RenderMetrics } from '../types/canvas'
import type { HandConnection } from '../types/handTracking'
import type { HandGestureMap } from '../types/gesture'
import type {
  InvisibilityRenderState,
  InvisibilityRuntimeStatus,
} from '../types/invisibility'
import type {
  PersonSegmentationMask,
  SegmentationDebugMode,
} from '../types/segmentation'
import { drawHandTracking } from '../utils/drawHandTracking'
import { PersonMaskRenderer } from '../utils/drawPersonSegmentation'
import { InvisibilityCompositor } from '../utils/invisibilityCompositor'

interface UseCanvasRendererOptions {
  stream: MediaStream | null
  isCameraActive: boolean
  processVideoFrame?: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => HandLandmarkerResult | null
  debugOverlayRef?: RefObject<boolean>
  handConnectionsRef?: RefObject<readonly HandConnection[]>
  gesturesRef?: RefObject<HandGestureMap>
  processSegmentationFrame?: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => void
  segmentationMaskRef?: RefObject<PersonSegmentationMask | null>
  segmentationDebugModeRef?: RefObject<SegmentationDebugMode>
  backgroundCanvasRef?: RefObject<HTMLCanvasElement | null>
  invisibilityRenderStateRef?: RefObject<InvisibilityRenderState>
  invisibilityRuntimeStatusRef?: RefObject<InvisibilityRuntimeStatus>
}

const FPS_SAMPLE_INTERVAL_MS = 750
const INITIAL_METRICS: RenderMetrics = {
  fps: 0,
  frameCount: 0,
  width: 1280,
  height: 720,
}

function clearCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.fillStyle = '#050607'
  context.fillRect(0, 0, canvas.width, canvas.height)
}

export function useCanvasRenderer({
  stream,
  isCameraActive,
  processVideoFrame,
  debugOverlayRef,
  handConnectionsRef,
  gesturesRef,
  processSegmentationFrame,
  segmentationMaskRef,
  segmentationDebugModeRef,
  backgroundCanvasRef,
  invisibilityRenderStateRef,
  invisibilityRuntimeStatusRef,
}: UseCanvasRendererOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const personMaskRendererRef = useRef<PersonMaskRenderer | null>(null)
  const invisibilityCompositorRef = useRef<InvisibilityCompositor | null>(null)
  const fallbackInvisibilityStatusRef = useRef<InvisibilityRuntimeStatus>({
    maskFresh: false,
    maskMotion: 0,
    colorMatchActive: false,
    colorMismatch: 0,
  })
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>('idle')
  const [metrics, setMetrics] = useState<RenderMetrics>(INITIAL_METRICS)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const context = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    })

    if (!context) {
      setCanvasStatus('error')
      return
    }

    clearCanvas(canvas, context)
    try {
      personMaskRendererRef.current ??= new PersonMaskRenderer()
      invisibilityCompositorRef.current ??= new InvisibilityCompositor()
    } catch (error) {
      console.error('Unable to initialize the canvas processing pipeline:', error)
      setCanvasStatus('error')
      return
    }
    const personMaskRenderer = personMaskRendererRef.current
    const invisibilityCompositor = invisibilityCompositorRef.current
    setMetrics(INITIAL_METRICS)

    if (!stream || !isCameraActive) {
      video.pause()
      video.srcObject = null
      personMaskRenderer.clear()
      invisibilityCompositor.clear()
      setCanvasStatus('idle')
      return
    }

    let disposed = false
    let renderingStarted = false
    let totalFrames = 0
    let framesInSample = 0
    let lastFpsSample = performance.now()
    let compositorErrorReported = false

    video.srcObject = stream
    setCanvasStatus('waiting')

    const renderFrame = (timestamp: number) => {
      if (disposed) return

      const sourceWidth = video.videoWidth
      const sourceHeight = video.videoHeight

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        sourceWidth > 0 &&
        sourceHeight > 0
      ) {
        // Canvas pixels follow the camera source; CSS independently controls display size.
        if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
          canvas.width = sourceWidth
          canvas.height = sourceHeight
        }

        const handResult = processVideoFrame?.(video, timestamp)
        processSegmentationFrame?.(video, timestamp)
        const invisibilityState = invisibilityRenderStateRef?.current
        let compositedFrame: HTMLCanvasElement | null = null
        if (invisibilityState?.enabled) {
          try {
            compositedFrame = invisibilityCompositor.compose(
              video,
              segmentationMaskRef?.current ?? null,
              backgroundCanvasRef?.current ?? null,
              invisibilityState.backgroundVersion,
              invisibilityState.quality,
              invisibilityRuntimeStatusRef?.current ??
                fallbackInvisibilityStatusRef.current,
              canvas.width,
              canvas.height,
              timestamp,
            )
            compositorErrorReported = false
          } catch (error) {
            if (!compositorErrorReported) {
              compositorErrorReported = true
              console.error('Invisible Mode compositing failed; showing the live frame:', error)
            }
          }
        }

        clearCanvas(canvas, context)

        // AI, capture, and compositing stay in raw coordinates. Mirror the final
        // camera/composite image once for the selfie display.
        context.save()
        context.translate(canvas.width, 0)
        context.scale(-1, 1)
        context.drawImage(
          compositedFrame ?? video,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        context.restore()

        personMaskRenderer.draw(
          context,
          segmentationMaskRef?.current ?? null,
          segmentationDebugModeRef?.current ?? 'off',
          canvas.width,
          canvas.height,
        )

        if (handResult && invisibilityState?.showHandOverlay !== false) {
          drawHandTracking(
            context,
            handResult,
            handConnectionsRef?.current ?? [],
            gesturesRef?.current ?? {},
            debugOverlayRef?.current ?? false,
            canvas.width,
            canvas.height,
          )
        }

        totalFrames += 1
        framesInSample += 1

        const sampleDuration = timestamp - lastFpsSample
        if (sampleDuration >= FPS_SAMPLE_INTERVAL_MS) {
          const fps = Math.round((framesInSample * 1000) / sampleDuration)
          setMetrics({
            fps,
            frameCount: totalFrames,
            width: canvas.width,
            height: canvas.height,
          })
          framesInSample = 0
          lastFpsSample = timestamp
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame)
    }

    const startRenderingWhenReady = () => {
      if (
        disposed ||
        renderingStarted ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        return
      }

      renderingStarted = true
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      setMetrics({
        fps: 0,
        frameCount: 0,
        width: video.videoWidth,
        height: video.videoHeight,
      })
      setCanvasStatus('rendering')
      lastFpsSample = performance.now()
      animationFrameRef.current = requestAnimationFrame(renderFrame)
    }

    video.addEventListener('loadedmetadata', startRenderingWhenReady)
    video.addEventListener('loadeddata', startRenderingWhenReady)
    video.addEventListener('canplay', startRenderingWhenReady)

    void video.play().then(startRenderingWhenReady).catch(() => {
      if (!disposed) setCanvasStatus('error')
    })

    startRenderingWhenReady()

    return () => {
      disposed = true
      video.removeEventListener('loadedmetadata', startRenderingWhenReady)
      video.removeEventListener('loadeddata', startRenderingWhenReady)
      video.removeEventListener('canplay', startRenderingWhenReady)

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      video.pause()
      if (video.srcObject === stream) video.srcObject = null
      clearCanvas(canvas, context)
      personMaskRenderer.clear()
      invisibilityCompositor.clear()
    }
  }, [
    backgroundCanvasRef,
    debugOverlayRef,
    gesturesRef,
    handConnectionsRef,
    invisibilityRenderStateRef,
    invisibilityRuntimeStatusRef,
    isCameraActive,
    processVideoFrame,
    processSegmentationFrame,
    segmentationDebugModeRef,
    segmentationMaskRef,
    stream,
  ])

  return {
    videoRef,
    canvasRef,
    canvasStatus,
    metrics,
  }
}
