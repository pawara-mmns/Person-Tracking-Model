import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { GESTURE_CONFIG } from '../config/gestureConfig'
import type {
  FingerAnalysis,
  FingerScores,
  FingerState,
  GestureName,
  GesturePrediction,
} from '../types/gesture'
import {
  angleBetween,
  direction,
  distance,
  normalizedDot,
  scoreRange,
} from './handGeometry'

interface FingerLandmarkIndexes {
  mcp: number
  pip: number
  dip: number
  tip: number
}

const FINGER_INDEXES = {
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
} as const satisfies Record<string, FingerLandmarkIndexes>

export function formatGestureName(gesture: GestureName) {
  return gesture.replaceAll('_', ' ')
}

function average(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function scoreFingerExtension(
  landmarks: NormalizedLandmark[],
  indexes: FingerLandmarkIndexes,
) {
  const { finger } = GESTURE_CONFIG
  const wrist = landmarks[0]
  const mcp = landmarks[indexes.mcp]
  const pip = landmarks[indexes.pip]
  const dip = landmarks[indexes.dip]
  const tip = landmarks[indexes.tip]
  if (!wrist || !mcp || !pip || !dip || !tip) return 0

  const pipScore = scoreRange(
    angleBetween(mcp, pip, dip),
    finger.pipAngleClosedDeg,
    finger.pipAngleOpenDeg,
  )
  const dipScore = scoreRange(
    angleBetween(pip, dip, tip),
    finger.dipAngleClosedDeg,
    finger.dipAngleOpenDeg,
  )
  const reachScore = scoreRange(
    distance(wrist, tip) / Math.max(distance(wrist, pip), 1e-6),
    finger.reachClosedRatio,
    finger.reachOpenRatio,
  )

  return pipScore * 0.45 + dipScore * 0.3 + reachScore * 0.25
}

function scoreThumbExtension(landmarks: NormalizedLandmark[]) {
  const { thumb } = GESTURE_CONFIG
  const cmc = landmarks[1]
  const mcp = landmarks[2]
  const ip = landmarks[3]
  const tip = landmarks[4]
  const indexMcp = landmarks[5]
  const pinkyMcp = landmarks[17]
  if (!cmc || !mcp || !ip || !tip || !indexMcp || !pinkyMcp) return 0

  const palmWidth = Math.max(distance(indexMcp, pinkyMcp), 1e-6)
  const mcpScore = scoreRange(
    angleBetween(cmc, mcp, ip),
    thumb.mcpAngleClosedDeg,
    thumb.mcpAngleOpenDeg,
  )
  const ipScore = scoreRange(
    angleBetween(mcp, ip, tip),
    thumb.ipAngleClosedDeg,
    thumb.ipAngleOpenDeg,
  )
  const spreadScore = scoreRange(
    distance(tip, indexMcp) / palmWidth,
    thumb.spreadClosedRatio,
    thumb.spreadOpenRatio,
  )
  const reachScore = scoreRange(
    distance(cmc, tip) / Math.max(distance(cmc, ip), 1e-6),
    thumb.reachClosedRatio,
    thumb.reachOpenRatio,
  )

  return mcpScore * 0.25 + ipScore * 0.25 + spreadScore * 0.3 + reachScore * 0.2
}

export function analyzeFingers(landmarks: NormalizedLandmark[]): FingerAnalysis {
  const scores: FingerScores = {
    thumb: scoreThumbExtension(landmarks),
    index: scoreFingerExtension(landmarks, FINGER_INDEXES.index),
    middle: scoreFingerExtension(landmarks, FINGER_INDEXES.middle),
    ring: scoreFingerExtension(landmarks, FINGER_INDEXES.ring),
    pinky: scoreFingerExtension(landmarks, FINGER_INDEXES.pinky),
  }

  return {
    scores,
    state: {
      thumb: scores.thumb >= GESTURE_CONFIG.thumb.extensionScoreThreshold,
      index: scores.index >= GESTURE_CONFIG.finger.extensionScoreThreshold,
      middle: scores.middle >= GESTURE_CONFIG.finger.extensionScoreThreshold,
      ring: scores.ring >= GESTURE_CONFIG.finger.extensionScoreThreshold,
      pinky: scores.pinky >= GESTURE_CONFIG.finger.extensionScoreThreshold,
    },
  }
}

function matchesFingerState(
  scores: FingerScores,
  expected: Partial<Record<keyof FingerState, boolean>>,
) {
  return average(
    Object.entries(expected).map(([fingerName, isOpen]) => {
      const score = scores[fingerName as keyof FingerScores]
      return isOpen ? score : 1 - score
    }),
  )
}

function isThumbPointingUp(landmarks: NormalizedLandmark[]) {
  const wrist = landmarks[0]
  const thumbMcp = landmarks[2]
  const thumbTip = landmarks[4]
  const middleMcp = landmarks[9]
  const indexMcp = landmarks[5]
  const pinkyMcp = landmarks[17]
  if (!wrist || !thumbMcp || !thumbTip || !middleMcp || !indexMcp || !pinkyMcp) {
    return false
  }

  const thumbDirection = direction(thumbMcp, thumbTip)
  const palmDirection = direction(wrist, middleMcp)
  const palmWidth = Math.max(distance(indexMcp, pinkyMcp), 1e-6)
  const verticalRise = thumbMcp.y - thumbTip.y
  const horizontalTravel = Math.abs(thumbTip.x - thumbMcp.x)

  return (
    normalizedDot(thumbDirection, palmDirection) >=
      GESTURE_CONFIG.thumb.upMinPalmAlignment &&
    verticalRise >= horizontalTravel * GESTURE_CONFIG.thumb.upMinVerticalRatio &&
    verticalRise / palmWidth >= GESTURE_CONFIG.thumb.upMinRisePalmRatio
  )
}

function makePrediction(
  gesture: GesturePrediction['gesture'],
  confidence: number,
  fingers: FingerState,
): GesturePrediction {
  return { gesture, confidence: Math.min(Math.max(confidence, 0), 1), fingers }
}

export function recognizeGesture(
  analysis: FingerAnalysis,
  landmarks: NormalizedLandmark[],
): GesturePrediction {
  const { state, scores } = analysis
  const allOpen = state.thumb && state.index && state.middle && state.ring && state.pinky
  const fourFingersClosed = !state.index && !state.middle && !state.ring && !state.pinky
  const peaceShape = state.index && state.middle && !state.ring && !state.pinky

  if (allOpen) {
    const confidence = matchesFingerState(scores, {
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    })
    if (confidence >= GESTURE_CONFIG.classifier.minimumKnownConfidence) {
      return makePrediction('OPEN_PALM', confidence, state)
    }
  }

  if (state.thumb && fourFingersClosed && isThumbPointingUp(landmarks)) {
    const confidence = matchesFingerState(scores, {
      thumb: true,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    })
    if (confidence >= GESTURE_CONFIG.classifier.minimumKnownConfidence) {
      return makePrediction('THUMBS_UP', confidence, state)
    }
  }

  if (peaceShape) {
    const confidence = matchesFingerState(scores, {
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    })
    if (confidence >= GESTURE_CONFIG.classifier.minimumKnownConfidence) {
      return makePrediction('PEACE', confidence, state)
    }
  }

  if (
    fourFingersClosed &&
    scores.thumb <= GESTURE_CONFIG.classifier.maximumFistThumbScore
  ) {
    const confidence = matchesFingerState(scores, {
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    })
    if (confidence >= GESTURE_CONFIG.classifier.minimumKnownConfidence) {
      return makePrediction('FIST', confidence, state)
    }
  }

  return makePrediction('UNKNOWN', 0, state)
}
