import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initElectronicThumb, getElectronicThumbContainer } from './electronicThumbApi'
import './index.css'

initElectronicThumb()
const container = getElectronicThumbContainer()
if (!container) {
  console.error('ElectronicThumb: no container found. Add a div with the electronic-thumb-widget attribute.')
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
