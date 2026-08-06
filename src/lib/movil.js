/**
 * Ajustes que solo tienen sentido dentro de la app de Android.
 *
 * En el navegador y en la app de escritorio no hace nada: `arrancarMovil()`
 * sale sin cargar ningún plugin.
 */

const esNativo = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

export async function arrancarMovil() {
  if (!esNativo()) return

  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ])

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#04060c' })
  } catch {
    /* algunas versiones de Android no dejan tocar la barra: no es motivo de nada */
  }

  /**
   * El botón atrás se comporta como ESC.
   *
   * Por defecto cierra la aplicación, y hacerlo en mitad de una carga de cien
   * palabras se lleva el bloque por delante. Como los seis módulos ya abortan
   * con ESC, basta con emitir esa tecla; solo se sale de verdad cuando ya no
   * hay nada que abortar y no queda historial de navegación.
   */
  App.addListener('backButton', ({ canGoBack }) => {
    const entrenando = document.querySelector('main [data-abortable], main input:not([type=file])')
    const hayBarra = !!document.querySelector('main .border-t.border-line-soft')
    if (hayBarra || entrenando) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return
    }
    if (canGoBack) window.history.back()
    else App.exitApp()
  })

  // El progreso se escribe al pasar a segundo plano: en Android el sistema puede
  // matar la aplicación sin previo aviso y sin que llegue ningún `pagehide`.
  App.addListener('pause', () => {
    window.dispatchEvent(new Event('pagehide'))
  })

  await SplashScreen.hide()
}
