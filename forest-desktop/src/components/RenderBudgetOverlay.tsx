// Simplified: Use browser DevTools instead of custom performance monitoring
// - React DevTools Profiler: ⌥⌘I → Profiler tab
// - Chrome Performance: ⌥⌘I → Performance tab
// - React Three Fiber built-in stats: <Stats /> from @react-three/drei

export function FrameMetricsTracker() {
  // Removed: custom metrics tracking
  // R3F automatically tracks performance in dev mode
  return null
}

export function RenderBudgetOverlay() {
  return (
    <div className="fixed top-5 left-5 text-xs text-white/40 select-none z-[9999] font-mono">
      React DevTools: ⌥⌘I
    </div>
  )
}
