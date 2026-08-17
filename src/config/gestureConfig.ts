export const GESTURE_CONFIG = Object.freeze({
  finger: Object.freeze({
    pipAngleClosedDeg: 105,
    pipAngleOpenDeg: 165,
    dipAngleClosedDeg: 115,
    dipAngleOpenDeg: 168,
    reachClosedRatio: 0.95,
    reachOpenRatio: 1.22,
    extensionScoreThreshold: 0.58,
  }),
  thumb: Object.freeze({
    mcpAngleClosedDeg: 105,
    mcpAngleOpenDeg: 155,
    ipAngleClosedDeg: 115,
    ipAngleOpenDeg: 165,
    spreadClosedRatio: 0.3,
    spreadOpenRatio: 0.72,
    reachClosedRatio: 1.05,
    reachOpenRatio: 1.5,
    extensionScoreThreshold: 0.56,
    upMinPalmAlignment: 0.38,
    upMinVerticalRatio: 0.4,
    upMinRisePalmRatio: 0.16,
  }),
  classifier: Object.freeze({
    minimumKnownConfidence: 0.56,
    maximumFistThumbScore: 0.76,
  }),
  stability: Object.freeze({
    historySize: 7,
    minimumVotes: 4,
    missingHandTimeoutMs: 500,
    uiUpdateIntervalMs: 100,
  }),
})

