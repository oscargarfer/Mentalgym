import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { arrancarMovil } from './lib/movil.js'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Barra de estado, botón atrás y pantalla de arranque de Android. Fuera del
// móvil no carga nada y no bloquea el pintado.
arrancarMovil()
