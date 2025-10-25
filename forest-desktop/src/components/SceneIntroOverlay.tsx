import { useMemo } from 'react'
import { useSceneMode, useSceneValue } from '../lib/sceneState'

export function SceneIntroOverlay() {
  const mode = useSceneMode()
  const progress = useSceneValue((state) => state.context.introProgress)
  const isVisible = mode === 'loading' || mode === 'intro'

  const label = useMemo(() => {
    if (mode === 'loading') {
      return 'Warming up the forest OS...'
    }
    if (mode === 'intro') {
      return 'Walking the canopy rails'
    }
    return ''
  }, [mode])

  if (!isVisible) {
    return null
  }

  const opacity = mode === 'loading' ? 1 : Math.max(0, 1 - progress)

  return (
    <div className="scene-intro-overlay" style={{ opacity }}>
      <div className="scene-intro-pulse" aria-hidden>
        <div
          className="scene-intro-progress"
          style={{ transform: `scaleX(${Math.max(0.05, progress)})` }}
        />
      </div>
      <p className="scene-intro-label">{label}</p>
    </div>
  )
}
