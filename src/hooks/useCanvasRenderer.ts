import { useEffect, useRef, useState } from 'react'
import type { CanvasStatus, RenderMetrics } from '../types/canvas'

interface UseCanvasRendererOptions {
  stream: MediaStream | null
  isCameraActive: boolean
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

export function useCanvasRenderer({ stream, isCameraActive }: UseCanvasRendererOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
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
    setMetrics(INITIAL_METRICS)

    if (!stream || !isCameraActive) {
      video.pause()
      video.srcObject = null
      setCanvasStatus('idle')
      return
    }

    let disposed = false
    let renderingStarted = false
    let totalFrames = 0
    let framesInSample = 0
    let lastFpsSample = performance.now()

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

        clearCanvas(canvas, context)

        // Mirror only the camera frame. Restoring the context keeps future overlays unmirrored.
        context.save()
        context.translate(canvas.width, 0)
        context.scale(-1, 1)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        context.restore()

        // Future phases can draw landmarks, masks, and effects here.

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
    }
  }, [isCameraActive, stream])

  return {
    videoRef,
    canvasRef,
    canvasStatus,
    metrics,
  }
}
