import React, { Component, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { createLogger } from '../lib/logger'

const logger = createLogger('ErrorBoundary')

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  level?: 'root' | 'component'
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * React Error Boundary with custom error UI and logging
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary level="root">
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('React error caught', { error, errorInfo })

    this.setState({ errorInfo })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Report to Tauri backend (for crash reporting, metrics, etc.)
    invoke('log_to_terminal', {
      level: 'error',
      message: `React Error: ${error.message}\n${errorInfo.componentStack}`,
    }).catch(() => {
      // Ignore logging errors
    })
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError)
      }

      // Default error UI
      return this.props.level === 'root' ? (
        <RootErrorFallback error={this.state.error} reset={this.resetError} />
      ) : (
        <ComponentErrorFallback error={this.state.error} reset={this.resetError} />
      )
    }

    return this.props.children
  }
}

/**
 * Root-level error fallback (catastrophic failures)
 */
function RootErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #0a0a0f 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#ef4444' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', lineHeight: '1.6' }}>
          Forest Desktop encountered an unexpected error and couldn't recover. You can try reloading
          the app or report this issue.
        </p>

        <details
          style={{
            marginBottom: '24px',
            textAlign: 'left',
            background: 'rgba(0,0,0,0.3)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          <summary style={{ cursor: 'pointer', marginBottom: '12px', color: '#f59e0b' }}>
            Error Details
          </summary>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.8)' }}>
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Reload App
          </button>
        </div>

        <p style={{ marginTop: '24px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
          Check the console (⌘⇧I) for more details
        </p>
      </div>
    </div>
  )
}

/**
 * Component-level error fallback (recoverable failures)
 */
function ComponentErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      style={{
        padding: '24px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        color: '#fff',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', color: '#ef4444', fontSize: '16px' }}>
        ⚠️ Component Error
      </h3>
      <p style={{ margin: '0 0 16px 0', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
        {error.message}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 16px',
          background: '#ef4444',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
        }}
      >
        Retry
      </button>
    </div>
  )
}
