import { SEGMENTATION_CONFIG } from '../config/segmentationConfig'
import type {
  PersonSegmentationMask,
  SegmentationDebugMode,
} from '../types/segmentation'

export class PersonMaskRenderer {
  private readonly maskCanvas: HTMLCanvasElement
  private readonly maskContext: CanvasRenderingContext2D
  private imageData: ImageData | null = null
  private renderedKey = ''

  constructor() {
    this.maskCanvas = document.createElement('canvas')
    const context = this.maskCanvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Unable to create the segmentation mask canvas.')
    this.maskContext = context
  }

  clear() {
    this.renderedKey = ''
    this.imageData = null
    this.maskCanvas.width = 1
    this.maskCanvas.height = 1
  }

  private updateMaskCanvas(
    mask: PersonSegmentationMask,
    mode: Exclude<SegmentationDebugMode, 'off'>,
  ) {
    const renderedKey = `${mask.version}:${mode}`
    if (this.renderedKey === renderedKey) return

    if (
      this.maskCanvas.width !== mask.width ||
      this.maskCanvas.height !== mask.height ||
      !this.imageData
    ) {
      this.maskCanvas.width = mask.width
      this.maskCanvas.height = mask.height
      this.imageData = this.maskContext.createImageData(mask.width, mask.height)
    }

    const pixels = this.imageData.data
    const overlayAlpha = SEGMENTATION_CONFIG.overlayOpacity
    const color = SEGMENTATION_CONFIG.overlayColor

    for (let maskIndex = 0, pixelIndex = 0; maskIndex < mask.data.length; maskIndex += 1, pixelIndex += 4) {
      const maskValue = mask.data[maskIndex] ?? 0
      if (mode === 'mask') {
        pixels[pixelIndex] = maskValue
        pixels[pixelIndex + 1] = maskValue
        pixels[pixelIndex + 2] = maskValue
        pixels[pixelIndex + 3] = 255
      } else {
        pixels[pixelIndex] = color.red
        pixels[pixelIndex + 1] = color.green
        pixels[pixelIndex + 2] = color.blue
        pixels[pixelIndex + 3] = Math.round(maskValue * overlayAlpha)
      }
    }

    this.maskContext.putImageData(this.imageData, 0, 0)
    this.renderedKey = renderedKey
  }

  draw(
    context: CanvasRenderingContext2D,
    mask: PersonSegmentationMask | null,
    mode: SegmentationDebugMode,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    if (!mask || mode === 'off') return

    this.updateMaskCanvas(mask, mode)
    context.save()
    context.translate(canvasWidth, 0)
    context.scale(-1, 1)
    context.filter = mode === 'overlay' ? 'blur(1px)' : 'none'
    context.drawImage(this.maskCanvas, 0, 0, canvasWidth, canvasHeight)
    context.restore()
  }
}

