import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { applyTheme } from './data/theme'
import App from './App'

applyTheme('purple')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
