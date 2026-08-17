import { useEffect, useState } from 'react'

interface ExtendedCameraCapabilities extends MediaTrackCapabilities {
  exposureMode?: readonly string[]
  whiteBalanceMode?: readonly string[]
  focusMode?: readonly string[]
}

interface CameraCapabilityState {
  exposureControl: boolean
  whiteBalanceControl: boolean
  focusControl: boolean
}

const INITIAL_CAPABILITIES: CameraCapabilityState = {
  exposureControl: false,
  whiteBalanceControl: false,
  focusControl: false,
}

export function useCameraCapabilities(stream: MediaStream | null) {
  const [capabilities, setCapabilities] = useState(INITIAL_CAPABILITIES)

  useEffect(() => {
    const track = stream?.getVideoTracks()[0]
    if (!track || typeof track.getCapabilities !== 'function') {
      setCapabilities(INITIAL_CAPABILITIES)
      return
    }
    try {
      const supported = track.getCapabilities() as ExtendedCameraCapabilities
      setCapabilities({
        exposureControl: Boolean(supported.exposureMode?.length),
        whiteBalanceControl: Boolean(supported.whiteBalanceMode?.length),
        focusControl: Boolean(supported.focusMode?.length),
      })
    } catch (error) {
      console.info('Camera capability inspection is unavailable:', error)
      setCapabilities(INITIAL_CAPABILITIES)
    }
  }, [stream])

  return capabilities
}
