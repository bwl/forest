import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { enableTerminalLogging } from './lib/console-logger'

// Enable console logging to terminal in development
if (import.meta.env.DEV) {
  enableTerminalLogging()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
