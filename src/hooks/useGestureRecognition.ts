import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { GESTURE_CONFIG } from '../config/gestureConfig'
import type {
  GestureHandedness,
  GestureName,
  GesturePrediction,
  HandGestureMap,
  HandGestureState,
} from '../types/gesture'
import { analyzeFingers, recognizeGesture } from '../utils/gestureRecognition'
import { stabilizeGesture } from '../utils/gestureStabilization'

interface UseGestureRecognitionOptions {
  enabled: boolean
}

interface GestureHistoryEntry {
  prediction: GesturePrediction
}

interface HandGestureTracker {
  history: GestureHistoryEntry[]
  stableGesture: GestureName
  stableSince: number
  lastSeenAt: number
}

function getHandedness(categoryName: string | undefined): GestureHandedness | null {
  if (categoryName?.toLowerCase() === 'left') return 'Left'
  if (categoryName?.toLowerCase() === 'right') return 'Right'
  return null
}

function getStableConfidence(history: GestureHistoryEntry[], gesture: GestureName) {
  const matching = history.filter((entry) => entry.prediction.gesture === gesture)
  if (matching.length === 0 || gesture === 'UNKNOWN') return 0

  return (
    matching.reduce((total, entry) => total + entry.prediction.confidence, 0) /
    matching.length
  )
}

export function useGestureRecognition({ enabled }: UseGestureRecognitionOptions) {
  const [gestures, setGestures] = useState<HandGestureMap>({})
  const gesturesRef = useRef<HandGestureMap>({})
  const trackersRef = useRef<Partial<Record<GestureHandedness, HandGestureTracker>>>({})
  const lastUiUpdateRef = useRef(-Infinity)

  const clearGestures = useCallback(() => {
    trackersRef.current = {}
    gesturesRef.current = {}
    lastUiUpdateRef.current = -Infinity
    setGestures({})
  }, [])

  useEffect(() => {
    if (!enabled) clearGestures()
  }, [clearGestures, enabled])

  const processGestureResult = useCallback(
    (result: HandLandmarkerResult, timestamp: number) => {
      if (!enabled) return

      const seenHands = new Set<GestureHandedness>()
      const nextGestures: HandGestureMap = { ...gesturesRef.current }

      result.landmarks.forEach((landmarks, handIndex) => {
        if (landmarks.length < 21) return

        const hand = getHandedness(
          result.handedness[handIndex]?.[0]?.categoryName,
        )
        if (!hand) return

        seenHands.add(hand)
        const prediction = recognizeGesture(analyzeFingers(landmarks), landmarks)
        const tracker = trackersRef.current[hand] ?? {
          history: [],
          stableGesture: 'UNKNOWN' as const,
          stableSince: timestamp,
          lastSeenAt: timestamp,
        }

        tracker.history.push({ prediction })
        if (tracker.history.length > GESTURE_CONFIG.stability.historySize) {
          tracker.history.shift()
        }

        const stableGesture = stabilizeGesture(
          tracker.history.map((entry) => entry.prediction.gesture),
          tracker.stableGesture,
        )
        if (stableGesture !== tracker.stableGesture) {
          tracker.stableGesture = stableGesture
          tracker.stableSince = timestamp
        }
        tracker.lastSeenAt = timestamp
        trackersRef.current[hand] = tracker

        const handState: HandGestureState = {
          hand,
          gesture: tracker.stableGesture,
          rawGesture: prediction.gesture,
          confidence: getStableConfidence(tracker.history, tracker.stableGesture),
          fingers: prediction.fingers,
          stableForMs: Math.max(0, timestamp - tracker.stableSince),
          lastSeenAt: timestamp,
        }
        nextGestures[hand] = handState
      })

      for (const hand of ['Left', 'Right'] as const) {
        const tracker = trackersRef.current[hand]
        if (
          tracker &&
          !seenHands.has(hand) &&
          timestamp - tracker.lastSeenAt >=
            GESTURE_CONFIG.stability.missingHandTimeoutMs
        ) {
          delete trackersRef.current[hand]
          delete nextGestures[hand]
        }
      }

      gesturesRef.current = nextGestures
      if (
        timestamp - lastUiUpdateRef.current >=
        GESTURE_CONFIG.stability.uiUpdateIntervalMs
      ) {
        lastUiUpdateRef.current = timestamp
        setGestures({ ...nextGestures })
      }
    },
    [enabled],
  )

  return {
    gestures,
    gesturesRef,
    processGestureResult,
    clearGestures,
  }
}
