import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'regenerator-runtime/runtime'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('PWA: Service worker is registered via vite-plugin-pwa')
  })
}
