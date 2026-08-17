import { INVISIBILITY_CONFIG } from '../config/invisibilityConfig'

export interface BackgroundColorMatchResult {
  canvas: HTMLCanvasElement
  active: boolean
  mismatch: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export class BackgroundColorMatcher {
  private readonly liveSampleCanvas: HTMLCanvasElement
  private readonly liveSampleContext: CanvasRenderingContext2D
  private readonly backgroundSampleCanvas: HTMLCanvasElement
  private readonly backgroundSampleContext: CanvasRenderingContext2D
  private readonly maskSampleCanvas: HTMLCanvasElement
  private readonly maskSampleContext: CanvasRenderingContext2D
  private readonly correctedCanvas: HTMLCanvasElement
  private readonly correctedContext: CanvasRenderingContext2D
  private sourcePixels: ImageData | null = null
  private correctedPixels: ImageData | null = null
  private backgroundVersion: number | null = null
  private lastUpdatedAt = -Infinity
  private scaleRed = 1
  private scaleGreen = 1
  private scaleBlue = 1
  private mismatch = 0

  constructor() {
    const sampleWidth = INVISIBILITY_CONFIG.colorMatchSampleWidth
    const sampleHeight = INVISIBILITY_CONFIG.colorMatchSampleHeight
    this.liveSampleCanvas = document.createElement('canvas')
    this.backgroundSampleCanvas = document.createElement('canvas')
    this.maskSampleCanvas = document.createElement('canvas')
    this.correctedCanvas = document.createElement('canvas')
    this.liveSampleCanvas.width = sampleWidth
    this.liveSampleCanvas.height = sampleHeight
    this.backgroundSampleCanvas.width = sampleWidth
    this.backgroundSampleCanvas.height = sampleHeight
    this.maskSampleCanvas.width = sampleWidth
    this.maskSampleCanvas.height = sampleHeight

    const liveContext = this.liveSampleCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    })
    const backgroundContext = this.backgroundSampleCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    })
    const maskContext = this.maskSampleCanvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
    })
    const correctedContext = this.correctedCanvas.getContext('2d', {
      alpha: false,
    })
    if (!liveContext || !backgroundContext || !maskContext || !correctedContext) {
      throw new Error('Unable to create background color-matching canvases.')
    }
    this.liveSampleContext = liveContext
    this.backgroundSampleContext = backgroundContext
    this.maskSampleContext = maskContext
    this.correctedContext = correctedContext
  }

  clear() {
    this.sourcePixels = null
    this.correctedPixels = null
    this.backgroundVersion = null
    this.lastUpdatedAt = -Infinity
    this.scaleRed = 1
    this.scaleGreen = 1
    this.scaleBlue = 1
    this.mismatch = 0
    this.correctedCanvas.width = 1
    this.correctedCanvas.height = 1
  }

  private loadBackground(background: HTMLCanvasElement, version: number | null) {
    if (
      this.backgroundVersion === version &&
      this.correctedCanvas.width === background.width &&
      this.correctedCanvas.height === background.height &&
      this.sourcePixels &&
      this.correctedPixels
    ) {
      return
    }

    this.correctedCanvas.width = background.width
    this.correctedCanvas.height = background.height
    this.correctedContext.drawImage(background, 0, 0)
    this.sourcePixels = this.correctedContext.getImageData(
      0,
      0,
      background.width,
      background.height,
    )
    this.correctedPixels = this.correctedContext.createImageData(
      background.width,
      background.height,
    )
    this.backgroundVersion = version
    this.lastUpdatedAt = -Infinity
    this.scaleRed = 1
    this.scaleGreen = 1
    this.scaleBlue = 1
  }

  private updateCorrectedBackground() {
    if (!this.sourcePixels || !this.correctedPixels) return
    const source = this.sourcePixels.data
    const corrected = this.correctedPixels.data
    for (let index = 0; index < source.length; index += 4) {
      corrected[index] = Math.round((source[index] ?? 0) * this.scaleRed)
      corrected[index + 1] = Math.round(
        (source[index + 1] ?? 0) * this.scaleGreen,
      )
      corrected[index + 2] = Math.round(
        (source[index + 2] ?? 0) * this.scaleBlue,
      )
      corrected[index + 3] = 255
    }
    this.correctedContext.putImageData(this.correctedPixels, 0, 0)
  }

  match(
    video: HTMLVideoElement,
    background: HTMLCanvasElement,
    processedMask: HTMLCanvasElement,
    backgroundVersion: number | null,
    timestampMs: number,
    enabled: boolean,
  ): BackgroundColorMatchResult {
    this.loadBackground(background, backgroundVersion)
    if (!enabled) {
      return { canvas: background, active: false, mismatch: 0 }
    }
    if (
      timestampMs - this.lastUpdatedAt <
      INVISIBILITY_CONFIG.colorMatchUpdateIntervalMs
    ) {
      return {
        canvas: this.correctedCanvas,
        active: true,
        mismatch: this.mismatch,
      }
    }

    const width = INVISIBILITY_CONFIG.colorMatchSampleWidth
    const height = INVISIBILITY_CONFIG.colorMatchSampleHeight
    this.liveSampleContext.drawImage(video, 0, 0, width, height)
    this.backgroundSampleContext.drawImage(background, 0, 0, width, height)
    this.maskSampleContext.clearRect(0, 0, width, height)
    this.maskSampleContext.drawImage(processedMask, 0, 0, width, height)

    const live = this.liveSampleContext.getImageData(0, 0, width, height).data
    const saved = this.backgroundSampleContext.getImageData(0, 0, width, height).data
    const mask = this.maskSampleContext.getImageData(0, 0, width, height).data
    let liveRed = 0
    let liveGreen = 0
    let liveBlue = 0
    let savedRed = 0
    let savedGreen = 0
    let savedBlue = 0
    let sampleCount = 0
    const excludedAlpha =
      INVISIBILITY_CONFIG.colorMatchMaskExclusionAlpha * 255

    for (let index = 0; index < live.length; index += 4) {
      if ((mask[index + 3] ?? 255) > excludedAlpha) continue
      liveRed += live[index] ?? 0
      liveGreen += live[index + 1] ?? 0
      liveBlue += live[index + 2] ?? 0
      savedRed += saved[index] ?? 0
      savedGreen += saved[index + 1] ?? 0
      savedBlue += saved[index + 2] ?? 0
      sampleCount += 1
    }

    if (sampleCount > 0) {
      const maximumDelta = INVISIBILITY_CONFIG.colorMatchMaximumScaleDelta
      const strength = INVISIBILITY_CONFIG.colorMatchStrength
      const targetRed = 1 +
        (clamp(liveRed / Math.max(savedRed, 1), 1 - maximumDelta, 1 + maximumDelta) - 1) * strength
      const targetGreen = 1 +
        (clamp(liveGreen / Math.max(savedGreen, 1), 1 - maximumDelta, 1 + maximumDelta) - 1) * strength
      const targetBlue = 1 +
        (clamp(liveBlue / Math.max(savedBlue, 1), 1 - maximumDelta, 1 + maximumDelta) - 1) * strength
      const history = INVISIBILITY_CONFIG.colorMatchSmoothing
      this.scaleRed = this.scaleRed * history + targetRed * (1 - history)
      this.scaleGreen = this.scaleGreen * history + targetGreen * (1 - history)
      this.scaleBlue = this.scaleBlue * history + targetBlue * (1 - history)
      this.mismatch = Math.max(
        Math.abs(targetRed - 1),
        Math.abs(targetGreen - 1),
        Math.abs(targetBlue - 1),
      )
      this.updateCorrectedBackground()
    }
    this.lastUpdatedAt = timestampMs
    return {
      canvas: this.correctedCanvas,
      active: true,
      mismatch: this.mismatch,
    }
  }
}
