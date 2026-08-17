import type { HandLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { HAND_OVERLAY_STYLE } from '../config/handTracking'
import type { HandConnection } from '../types/handTracking'

interface CanvasPoint {
  x: number
  y: number
}

function toMirroredCanvasPoint(
  landmark: NormalizedLandmark,
  canvasWidth: number,
  canvasHeight: number,
): CanvasPoint {
  return {
    x: (1 - landmark.x) * canvasWidth,
    y: landmark.y * canvasHeight,
  }
}

function drawHandLabel(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  handedness: string,
  color: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  const points = landmarks.map((landmark) =>
    toMirroredCanvasPoint(landmark, canvasWidth, canvasHeight),
  )
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  const label = `${handedness.toUpperCase()} HAND`

  context.font = HAND_OVERLAY_STYLE.labelFont
  context.textBaseline = 'middle'
  const textWidth = context.measureText(label).width
  const labelX = Math.min(Math.max(left, 8), canvasWidth - textWidth - 22)
  const labelY = Math.max(top - 25, 8)

  context.fillStyle = 'rgba(5, 6, 7, 0.78)'
  context.fillRect(labelX, labelY, textWidth + 18, 22)
  context.fillStyle = color
  context.fillText(label, labelX + 9, labelY + 11)
}

export function drawHandTracking(
  context: CanvasRenderingContext2D,
  result: HandLandmarkerResult,
  connections: readonly HandConnection[],
  canvasWidth: number,
  canvasHeight: number,
) {
  result.landmarks.forEach((landmarks, handIndex) => {
    const color = HAND_OVERLAY_STYLE.handColors[handIndex % HAND_OVERLAY_STYLE.handColors.length]

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'

    for (const connection of connections) {
      const start = landmarks[connection.start]
      const end = landmarks[connection.end]
      if (!start || !end) continue

      const startPoint = toMirroredCanvasPoint(start, canvasWidth, canvasHeight)
      const endPoint = toMirroredCanvasPoint(end, canvasWidth, canvasHeight)

      context.beginPath()
      context.moveTo(startPoint.x, startPoint.y)
      context.lineTo(endPoint.x, endPoint.y)
      context.strokeStyle = 'rgba(5, 6, 7, 0.72)'
      context.lineWidth = HAND_OVERLAY_STYLE.connectionWidth + 2.5
      context.stroke()

      context.strokeStyle = color
      context.lineWidth = HAND_OVERLAY_STYLE.connectionWidth
      context.stroke()
    }

    for (const landmark of landmarks) {
      const point = toMirroredCanvasPoint(landmark, canvasWidth, canvasHeight)

      context.beginPath()
      context.arc(point.x, point.y, HAND_OVERLAY_STYLE.landmarkRadius, 0, Math.PI * 2)
      context.fillStyle = color
      context.fill()
      context.strokeStyle = 'rgba(5, 6, 7, 0.85)'
      context.lineWidth = HAND_OVERLAY_STYLE.landmarkBorderWidth
      context.stroke()
    }

    const handedness = result.handedness[handIndex]?.[0]?.categoryName ?? 'Hand'
    drawHandLabel(context, landmarks, handedness, color, canvasWidth, canvasHeight)
    context.restore()
  })
}
