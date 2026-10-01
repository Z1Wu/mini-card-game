import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
<<<<<<< HEAD
import './assets/styles/apocalypse-table.css'
=======
import './assets/styles/campus-table.css'
>>>>>>> origin/main
import { installGameTestHooks } from './utils/testHooks.ts'

installGameTestHooks()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

