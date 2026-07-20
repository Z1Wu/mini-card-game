import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { installGameTestHooks } from './utils/testHooks.ts'

installGameTestHooks()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
