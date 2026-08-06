import { Suspense, lazy, useState } from 'react'
import { AppProvider, useApp } from './state/AppContext.jsx'
import Shell, { NAV } from './components/Shell.jsx'
import { useKeydown, isTyping } from './lib/useKeydown.js'
import Settings from './views/Settings.jsx'
import Method from './views/Method.jsx'
import Warmup from './modules/Warmup.jsx'
import Massive from './modules/Massive.jsx'
import Review from './modules/Review.jsx'
import Tachistoscope from './modules/Tachistoscope.jsx'
import Numbers from './modules/Numbers.jsx'
import Palace from './modules/Palace.jsx'

// El dashboard arrastra recharts: se carga solo cuando se abre.
const Dashboard = lazy(() => import('./views/Dashboard.jsx'))

const VIEWS = {
  dashboard: Dashboard,
  warmup: Warmup,
  massive: Massive,
  review: Review,
  rsvp: Tachistoscope,
  numbers: Numbers,
  palace: Palace,
  method: Method,
  settings: Settings,
}

function Router() {
  const [view, setView] = useState('dashboard')
  const { locked } = useApp()

  // Navegacion global por numeros. Se desactiva mientras un modulo esta en marcha.
  useKeydown((e) => {
    if (locked || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return
    const hit = NAV.find((n) => n.key === e.key)
    if (hit) {
      e.preventDefault()
      setView(hit.id)
    }
  })

  const View = VIEWS[view] || Dashboard

  return (
    <Shell view={view} setView={setView}>
      <Suspense fallback={<Loading />}>
        {/* La `key` fuerza el desmontaje limpio de temporizadores al cambiar de modulo */}
        <View key={view} />
      </Suspense>
    </Shell>
  )
}

function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-mute">
        cargando módulo…
      </span>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
