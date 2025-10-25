import { useEffect, useMemo, useState } from 'react'
import type { FrameMetricsDetail } from './WebGLScene'
import { FRAME_EVENT } from './WebGLScene'

interface Metrics extends FrameMetricsDetail {
  budgetRatio: number
}

const DEFAULT_METRICS: Metrics = {
  frameMs: 16.67,
  fps: 60,
  updateCostMs: 0,
  budgetRatio: 100,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function RenderBudgetOverlay() {
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const custom = event as CustomEvent<FrameMetricsDetail>
      if (!custom.detail) return
      const frameMs = Number.isFinite(custom.detail.frameMs) ? custom.detail.frameMs : 0
      const fps = Number.isFinite(custom.detail.fps) ? custom.detail.fps : 0
      const updateCostMs = custom.detail.updateCostMs ?? 0
      const ratio = clamp((frameMs / 16.67) * 100, 0, 400)
      setMetrics({
        frameMs,
        fps,
        updateCostMs,
        budgetRatio: ratio,
      })
    }

    window.addEventListener(FRAME_EVENT, handler as EventListener)
    return () => window.removeEventListener(FRAME_EVENT, handler as EventListener)
  }, [])

  const budgetStatus = useMemo(() => {
    if (metrics.budgetRatio <= 100) return 'healthy'
    if (metrics.budgetRatio <= 130) return 'approaching'
    return 'over'
  }, [metrics.budgetRatio])

  return (
    <div className={`render-budget-overlay render-budget-${budgetStatus}`}>
      <div className="render-budget-header">Render Budget</div>
      <div className="render-budget-grid">
        <div>
          <span className="render-budget-value">{metrics.fps.toFixed(1)}</span>
          <span className="render-budget-label">FPS</span>
        </div>
        <div>
          <span className="render-budget-value">{metrics.frameMs.toFixed(2)} ms</span>
          <span className="render-budget-label">Frame</span>
        </div>
        <div>
          <span className="render-budget-value">{metrics.updateCostMs.toFixed(2)} ms</span>
          <span className="render-budget-label">Batch Upload</span>
        </div>
      </div>
      <div className="render-budget-progress">
        <div className="render-budget-progress-bar" style={{ width: `${metrics.budgetRatio}%` }} />
        <div className="render-budget-threshold" style={{ left: '100%' }} />
      </div>
    </div>
  )
}
