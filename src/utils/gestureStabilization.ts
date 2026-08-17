import { GESTURE_CONFIG } from '../config/gestureConfig'
import type { GestureName } from '../types/gesture'

export interface GestureVote {
  gesture: GestureName
  votes: number
}

export function getGestureMajority(history: readonly GestureName[]): GestureVote {
  const counts = new Map<GestureName, number>()
  for (const gesture of history) {
    counts.set(gesture, (counts.get(gesture) ?? 0) + 1)
  }

  let gesture: GestureName = 'UNKNOWN'
  let votes = 0
  for (const [candidate, count] of counts) {
    if (count > votes) {
      gesture = candidate
      votes = count
    }
  }

  return { gesture, votes }
}

export function stabilizeGesture(
  history: readonly GestureName[],
  currentGesture: GestureName,
) {
  const majority = getGestureMajority(history)
  return majority.votes >= GESTURE_CONFIG.stability.minimumVotes
    ? majority.gesture
    : currentGesture
}

