import { INVISIBILITY_CONFIG } from '../config/invisibilityConfig'
import type {
  InvisibilityQualitySettings,
  InvisibilityRuntimeStatus,
} from '../types/invisibility'
import type { PersonSegmentationMask } from '../types/segmentation'
import { BackgroundColorMatcher } from './backgroundColorMatching'
import { PersonAlphaMaskProcessor } from './maskProcessing'

export interface BackgroundCompatibility {
  compatible: boolean
  error: string | null
}

export function validateBackgroundCompatibility(
  background: HTMLCanvasElement | null,
  processingWidth: number,
  processingHeight: number,
): BackgroundCompatibility {
  if (!background || background.width <= 1 || background.height <= 1) {
    return { compatible: false, error: 'A captured background is unavailable.' }
  }
  if (
    background.width !== processingWidth ||
    background.height !== processingHeight
  ) {
    return {
      compatible: false,
      error: 'The captured background does not match the camera resolution.',
    }
  }
  return { compatible: true, error: null }
}

export function isSegmentationMaskFresh(
  mask: PersonSegmentationMask | null,
  timestampMs: number,
) {
  return Boolean(
    mask &&
      timestampMs - mask.timestampMs <= INVISIBILITY_CONFIG.maskStaleAfterMs,
  )
}

export class InvisibilityCompositor {
  private readonly compositeCanvas: HTMLCanvasElement
  private readonly compositeContext: CanvasRenderingContext2D
  private readonly replacementCanvas: HTMLCanvasElement
  private readonly replacementContext: CanvasRenderingContext2D
  private readonly maskSourceCanvas: HTMLCanvasElement
  private readonly maskSourceContext: CanvasRenderingContext2D
  private readonly processedMaskCanvas: HTMLCanvasElement
  private readonly processedMaskContext: CanvasRenderingContext2D
  private readonly maskProcessor = new PersonAlphaMaskProcessor()
  private readonly colorMatcher = new BackgroundColorMatcher()
  private maskImageData: ImageData | null = null
  private maskImageBufferVersion = -1
  private renderedMaskKey = ''
  private maskHasPerson = false
  private maskMotion = 0

  constructor() {
    this.compositeCanvas = document.createElement('canvas')
    this.replacementCanvas = document.createElement('canvas')
    this.maskSourceCanvas = document.createElement('canvas')
    this.processedMaskCanvas = document.createElement('canvas')

    const compositeContext = this.compositeCanvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    })
    const replacementContext = this.replacementCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    })
    const maskSourceContext = this.maskSourceCanvas.getContext('2d', {
      alpha: true,
    })
    const processedMaskContext = this.processedMaskCanvas.getContext('2d', {
      alpha: true,
    })
    if (
      !compositeContext ||
      !replacementContext ||
      !maskSourceContext ||
      !processedMaskContext
    ) {
      throw new Error('Unable to create invisibility compositor canvases.')
    }

    this.compositeContext = compositeContext
    this.replacementContext = replacementContext
    this.maskSourceContext = maskSourceContext
    this.processedMaskContext = processedMaskContext
  }

  clear() {
    this.renderedMaskKey = ''
    this.maskImageData = null
    this.maskImageBufferVersion = -1
    this.maskHasPerson = false
    this.maskMotion = 0
    this.maskProcessor.clear()
    this.colorMatcher.clear()
    for (const canvas of [
      this.compositeCanvas,
      this.replacementCanvas,
      this.maskSourceCanvas,
      this.processedMaskCanvas,
    ]) {
      canvas.width = 1
      canvas.height = 1
    }
  }

  private ensureProcessingSize(width: number, height: number) {
    if (
      this.compositeCanvas.width === width &&
      this.compositeCanvas.height === height
    ) {
      return
    }
    this.compositeCanvas.width = width
    this.compositeCanvas.height = height
    this.replacementCanvas.width = width
    this.replacementCanvas.height = height
    this.processedMaskCanvas.width = width
    this.processedMaskCanvas.height = height
    this.renderedMaskKey = ''
  }

  private updateMask(
    mask: PersonSegmentationMask,
    width: number,
    height: number,
    sourceWidth: number,
    quality: InvisibilityQualitySettings,
  ) {
    const maskKey = [
      mask.version,
      width,
      height,
      Number(quality.temporalSmoothingEnabled),
      Number(quality.featheringEnabled),
    ].join(':')
    if (this.renderedMaskKey === maskKey) return this.maskHasPerson

    const processed = this.maskProcessor.process(
      mask,
      quality.temporalSmoothingEnabled,
    )
    if (
      !this.maskImageData ||
      this.maskImageBufferVersion !== processed.bufferVersion
    ) {
      this.maskSourceCanvas.width = processed.width
      this.maskSourceCanvas.height = processed.height
      this.maskImageData = new ImageData(
        processed.rgba,
        processed.width,
        processed.height,
      )
      this.maskImageBufferVersion = processed.bufferVersion
    }
    this.maskSourceContext.putImageData(this.maskImageData, 0, 0)

    const resolutionScale = width / Math.max(sourceWidth, 1)
    const dilationRadius =
      INVISIBILITY_CONFIG.dilationRadiusPx * resolutionScale
    const featherRadius =
      INVISIBILITY_CONFIG.featherRadiusPx * resolutionScale
    const diagonalRadius = dilationRadius * Math.SQRT1_2
    const offsets = dilationRadius > 0
      ? [
          [-dilationRadius, 0],
          [dilationRadius, 0],
          [0, -dilationRadius],
          [0, dilationRadius],
          [-diagonalRadius, -diagonalRadius],
          [diagonalRadius, -diagonalRadius],
          [-diagonalRadius, diagonalRadius],
          [diagonalRadius, diagonalRadius],
          [0, 0],
        ]
      : [[0, 0]]

    const context = this.processedMaskContext
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = 1
    context.filter =
      quality.featheringEnabled && INVISIBILITY_CONFIG.edgeFeatherEnabled
        ? `blur(${featherRadius}px)`
        : 'none'
    context.clearRect(0, 0, width, height)
    for (const [offsetX, offsetY] of offsets) {
      context.drawImage(
        this.maskSourceCanvas,
        offsetX,
        offsetY,
        width,
        height,
      )
    }
    context.filter = 'none'

    this.maskHasPerson = processed.hasPerson
    this.maskMotion = processed.motion
    this.renderedMaskKey = maskKey
    return this.maskHasPerson
  }

  private drawProcessedMaskDebug(width: number, height: number) {
    this.compositeContext.setTransform(1, 0, 0, 1, 0, 0)
    this.compositeContext.globalCompositeOperation = 'source-over'
    this.compositeContext.globalAlpha = 1
    this.compositeContext.fillStyle = '#000'
    this.compositeContext.fillRect(0, 0, width, height)
    this.compositeContext.drawImage(this.processedMaskCanvas, 0, 0)
    return this.compositeCanvas
  }

  compose(
    video: HTMLVideoElement,
    mask: PersonSegmentationMask | null,
    background: HTMLCanvasElement | null,
    backgroundVersion: number | null,
    quality: InvisibilityQualitySettings,
    runtimeStatus: InvisibilityRuntimeStatus,
    width: number,
    height: number,
    timestampMs: number,
  ): HTMLCanvasElement | null {
    runtimeStatus.maskFresh = isSegmentationMaskFresh(mask, timestampMs)
    if (
      !background ||
      background.width !== width ||
      background.height !== height ||
      !mask ||
      !runtimeStatus.maskFresh ||
      mask.width <= 0 ||
      mask.height <= 0 ||
      mask.data.length !== mask.width * mask.height
    ) {
      runtimeStatus.colorMatchActive = false
      runtimeStatus.colorMismatch = 0
      return null
    }

    const processingWidth = Math.max(
      1,
      Math.round(width * INVISIBILITY_CONFIG.processingScale),
    )
    const processingHeight = Math.max(
      1,
      Math.round(height * INVISIBILITY_CONFIG.processingScale),
    )
    this.ensureProcessingSize(processingWidth, processingHeight)
    const hasPerson = this.updateMask(
      mask,
      processingWidth,
      processingHeight,
      width,
      quality,
    )
    runtimeStatus.maskMotion = this.maskMotion

    if (quality.debugView === 'processed-mask') {
      runtimeStatus.colorMatchActive = false
      return this.drawProcessedMaskDebug(processingWidth, processingHeight)
    }
    if (quality.debugView === 'background-plate') {
      runtimeStatus.colorMatchActive = false
      runtimeStatus.colorMismatch = 0
      return background
    }
    if (!hasPerson) {
      runtimeStatus.colorMatchActive = false
      runtimeStatus.colorMismatch = 0
      return null
    }

    const colorMatch = this.colorMatcher.match(
      video,
      background,
      this.processedMaskCanvas,
      backgroundVersion,
      timestampMs,
      quality.colorMatchingEnabled &&
        INVISIBILITY_CONFIG.colorMatchingEnabled,
    )
    runtimeStatus.colorMatchActive = colorMatch.active
    runtimeStatus.colorMismatch = colorMatch.mismatch
    const replacementContext = this.replacementContext
    replacementContext.setTransform(1, 0, 0, 1, 0, 0)
    replacementContext.globalAlpha = 1
    replacementContext.globalCompositeOperation = 'source-over'
    replacementContext.clearRect(0, 0, processingWidth, processingHeight)
    replacementContext.drawImage(
      colorMatch.canvas,
      0,
      0,
      processingWidth,
      processingHeight,
    )
    replacementContext.globalCompositeOperation = 'destination-in'
    replacementContext.drawImage(this.processedMaskCanvas, 0, 0)
    replacementContext.globalCompositeOperation = 'source-over'

    const compositeContext = this.compositeContext
    compositeContext.setTransform(1, 0, 0, 1, 0, 0)
    compositeContext.globalAlpha = 1
    compositeContext.globalCompositeOperation = 'source-over'
    compositeContext.drawImage(
      video,
      0,
      0,
      processingWidth,
      processingHeight,
    )
    compositeContext.globalAlpha =
      INVISIBILITY_CONFIG.backgroundBlendStrength
    compositeContext.drawImage(this.replacementCanvas, 0, 0)
    compositeContext.globalAlpha = 1

    if (quality.debugView === 'split') {
      compositeContext.drawImage(
        video,
        width / 2,
        0,
        width / 2,
        height,
        processingWidth / 2,
        0,
        processingWidth / 2,
        processingHeight,
      )
    }
    return this.compositeCanvas
  }
}
