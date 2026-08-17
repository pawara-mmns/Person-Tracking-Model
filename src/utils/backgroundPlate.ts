export class BackgroundPlateAccumulator {
  private channelSums = new Uint32Array(0)
  private width = 0
  private height = 0
  private frameCount = 0

  get framesAccumulated() {
    return this.frameCount
  }

  clear() {
    this.channelSums = new Uint32Array(0)
    this.width = 0
    this.height = 0
    this.frameCount = 0
  }

  addFrame(frame: Uint8ClampedArray, width: number, height: number) {
    if (frame.length !== width * height * 4 || width <= 0 || height <= 0) {
      throw new Error('Cannot average an invalid background frame.')
    }
    const requiredLength = width * height * 3
    if (
      this.width !== width ||
      this.height !== height ||
      this.channelSums.length !== requiredLength
    ) {
      this.channelSums = new Uint32Array(requiredLength)
      this.width = width
      this.height = height
      this.frameCount = 0
    }

    for (
      let pixelIndex = 0, channelIndex = 0;
      pixelIndex < frame.length;
      pixelIndex += 4, channelIndex += 3
    ) {
      this.channelSums[channelIndex] += frame[pixelIndex] ?? 0
      this.channelSums[channelIndex + 1] += frame[pixelIndex + 1] ?? 0
      this.channelSums[channelIndex + 2] += frame[pixelIndex + 2] ?? 0
    }
    this.frameCount += 1
  }

  writeAverage(canvas: HTMLCanvasElement) {
    if (this.frameCount <= 0 || this.width <= 0 || this.height <= 0) {
      throw new Error('No background frames are available to average.')
    }
    canvas.width = this.width
    canvas.height = this.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Unable to create the averaged background canvas.')
    const averagedFrame = context.createImageData(this.width, this.height)
    for (
      let pixelIndex = 0, channelIndex = 0;
      pixelIndex < averagedFrame.data.length;
      pixelIndex += 4, channelIndex += 3
    ) {
      averagedFrame.data[pixelIndex] = Math.round(
        (this.channelSums[channelIndex] ?? 0) / this.frameCount,
      )
      averagedFrame.data[pixelIndex + 1] = Math.round(
        (this.channelSums[channelIndex + 1] ?? 0) / this.frameCount,
      )
      averagedFrame.data[pixelIndex + 2] = Math.round(
        (this.channelSums[channelIndex + 2] ?? 0) / this.frameCount,
      )
      averagedFrame.data[pixelIndex + 3] = 255
    }
    context.putImageData(averagedFrame, 0, 0)
  }
}
