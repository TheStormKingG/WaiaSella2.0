// Mobile Optimization - Memory Management for All Devices (ARCHIVED)
// NOTE: The manual-only image workflow no longer uses these helpers.

export function isMobileDevice(): boolean {
  // Check if running on mobile device
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function getDeviceInfo(): { isMobile: boolean; memoryGB: number | null } {
  // @ts-ignore - navigator.deviceMemory is experimental
  const deviceMemory = navigator.deviceMemory || null
  const isMobile = isMobileDevice()
  
  console.log('📱 Device Info:')
  console.log(`   Type: ${isMobile ? 'Mobile' : 'Desktop'}`)
  console.log(`   Memory: ${deviceMemory ? deviceMemory + 'GB' : 'Unknown'}`)
  
  return { isMobile, memoryGB: deviceMemory }
}

// Force garbage collection if available
export function clearMemory(): void {
  // Request garbage collection (only works in some browsers with flags)
  // @ts-ignore
  if (window.gc) {
    console.log('🧹 Forcing garbage collection...')
    // @ts-ignore
    window.gc()
  }
  
  // Clear any large cached objects
  try {
    // Request browser to free up memory
    if ('memory' in performance) {
      // @ts-ignore
      const memoryInfo = performance.memory
      console.log(`   Memory before cleanup: ${(memoryInfo.usedJSHeapSize / 1048576).toFixed(2)}MB`)
    }
  } catch (e) {
    // Ignore if not available
  }
}

// Memory-aware delay to allow cleanup
export async function memoryCleanupDelay(ms: number = 100): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      clearMemory()
      resolve()
    }, ms)
  })
}

