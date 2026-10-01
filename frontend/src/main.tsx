import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './assets/styles/campus-table.css'
import './assets/styles/horror-table.css'
import { installGameTestHooks } from './utils/testHooks.ts'

installGameTestHooks()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

