import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { ClaudeStatus } from '@shared/ipc'
import { SECTION_GROUPS, SECTIONS, type Navigate, type NavParams, type SectionId } from './navigation'
import Icon from './components/Icon'
import Logo from './components/Logo'
import LanguageSwitcher from './components/LanguageSwitcher'
import Splash from './components/Splash'
import TitleBar from './components/TitleBar'
import { useSettings } from './theme/SettingsProvider'
import Home from './pages/Home'
import CommandPalette from './components/CommandPalette'
import { readLocal, ShellContext, writeLocal } from './shell'
import { WelcomeTour, WhatsNew } from './components/Welcome'
import RewardToasts from './components/RewardToasts'

// Inicio va en el paquete principal; el resto de las secciones se carga cuando se abre
// (y en segundo plano apenas la app queda tranquila, para que el primer clic sea instantáneo).
const PAGES = {
  temario: () => import('./pages/Curriculum'),
  practica: () => import('./pages/Practice'),
  repaso: () => import('./pages/Review'),
  juegos: () => import('./pages/Games'),
  lecturas: () => import('./pages/Readings'),
  diario: () => import('./pages/Journal'),
  ayuda: () => import('./pages/Help'),
  estadisticas: () => import('./pages/Stats'),
  biblioteca: () => import('./pages/Library'),
  charla: () => import('./pages/Chat'),
  resumenes: () => import('./pages/Summaries'),
  pruebas: () => import('./pages/Tests'),
  progreso: () => import('./pages/Progress'),
  ajustes: () => import('./pages/Settings'),
  comentarios: () => import('./pages/Comments'),
  acerca: () => import('./pages/About')
}
const Curriculum = lazy(PAGES.temario)
const Practice = lazy(PAGES.practica)
const Review = lazy(PAGES.repaso)
const Games = lazy(PAGES.juegos)
const Readings = lazy(PAGES.lecturas)
const Journal = lazy(PAGES.diario)
const Help = lazy(PAGES.ayuda)
const Stats = lazy(PAGES.estadisticas)
const Library = lazy(PAGES.biblioteca)
const Chat = lazy(PAGES.charla)
const Summaries = lazy(PAGES.resumenes)
const Tests = lazy(PAGES.pruebas)
const Progress = lazy(PAGES.progreso)
const Settings = lazy(PAGES.ajustes)
const Comments = lazy(PAGES.comentarios)
const About = lazy(PAGES.acerca)

function preloadPages(): void {
  const run = (): void => Object.values(PAGES).forEach((load) => void load().catch(() => undefined))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

type ReadyStatus = Extract<ClaudeStatus, { state: 'ready' }>


export default function App(): React.JSX.Element {
  const { settings } = useSettings()
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  // La pantalla de carga se muestra una sola vez, al abrir la app (si no está apagada en Ajustes).
  const [splashDone, setSplashDone] = useState(() => settings.splash === 'none')
  const finishSplash = useCallback(() => setSplashDone(true), [])

  const checkStatus = useCallback(() => {
    setStatus(null)
    window.api
      .getClaudeStatus()
      .then(setStatus)
      .catch((err: Error) => setStatus({ state: 'error', message: err.message }))
  }, [])

  useEffect(checkStatus, [checkStatus])

  let screen: React.JSX.Element
  if (!status) {
    screen = (
      <>
        <TitleBar title="Enhome" />
        <main className="centered">{splashDone && <p className="muted">Verificando tu sesión de Claude…</p>}</main>
      </>
    )
  } else if (status.state !== 'ready') {
    screen = <LockScreen status={status} onRetry={checkStatus} />
  } else {
    // Cambiar de idioma rearma todas las secciones con los datos del otro curso.
    screen = <Shell key={settings.language} status={status} />
  }

  return (
    <>
      {screen}
      {!splashDone && <Splash ready={status !== null} onDone={finishSplash} />}
    </>
  )
}

function LockScreen({ status, onRetry }: { status: Exclude<ClaudeStatus, ReadyStatus>; onRetry: () => void }): React.JSX.Element {
  const message = {
    'not-installed': 'No se encontró Claude Code en esta computadora. Instalalo desde claude.com/claude-code y volvé a intentar.',
    'logged-out': 'Claude Code está instalado pero no tiene sesión iniciada. Abrí una terminal, ejecutá "claude" e iniciá sesión con tu cuenta.',
    'no-subscription': 'Claude Code está usando otro método de acceso. Esta app requiere iniciar sesión con una suscripción de claude.ai (Pro o superior).',
    error: `No se pudo verificar la sesión de Claude: ${status.state === 'error' ? status.message : ''}`
  }[status.state]
  const { settings } = useSettings()

  return (
    <>
      <TitleBar title="Enhome" />
      <main className="centered">
        <div className="card lock stack">
          <Logo style={settings.style} className="logo lock-logo" />
          <h1>Enhome</h1>
          <p>{message}</p>
          <div>
            <button className="btn" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        </div>
      </main>
    </>
  )
}

function Shell({ status }: { status: ReadyStatus }): React.JSX.Element {
  const { settings } = useSettings()
  // Al abrir, vuelve a la última sección que se usó.
  const [section, setSection] = useState<SectionId>(() => {
    const last = readLocal('section')
    return SECTIONS.some((s) => s.id === last) ? (last as SectionId) : 'inicio'
  })
  const [params, setParams] = useState<NavParams>({})
  // Durante un examen semanal no se puede salir de Pruebas.
  const [examLocked, setExamLocked] = useState(false)
  const [collapsed, setCollapsed] = useState(() => readLocal('sidebar') === 'collapsed')
  // En ventanas de menos de 1000 px la barra lateral queda plegada sola.
  const narrow = useMediaQuery('(max-width: 999px)')
  const folded = collapsed || narrow
  const [focus, setFocus] = useState(false)
  const [palette, setPalette] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => undefined)
  }, [])

  useEffect(() => writeLocal('section', section), [section])
  useEffect(() => writeLocal('sidebar', collapsed ? 'collapsed' : 'open'), [collapsed])
  // Al cambiar de sección se sale del modo enfoque.
  useEffect(() => setFocus(false), [section])

  useEffect(() => {
    window.api
      .getExamLock()
      .then((locked) => {
        if (!locked) return
        setExamLocked(true)
        setSection('pruebas')
      })
      .catch(() => undefined)
  }, [])

  useEffect(preloadPages, [])

  const navigate: Navigate = useCallback(
    (target, extra = {}) => {
      if (examLocked && target !== 'pruebas') return
      setSection(target)
      setParams(extra)
    },
    [examLocked]
  )

  // Ctrl+K busca, Ctrl+1 a Ctrl+9 van a las secciones, Ctrl+B pliega la barra y Esc sale del modo enfoque.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'k') {
          event.preventDefault()
          setPalette((open) => !open)
        } else if (key === 'b') {
          event.preventDefault()
          setCollapsed((c) => !c)
        } else if (/^[1-9]$/.test(key)) {
          const target = SECTIONS[Number(key) - 1]
          if (target) {
            event.preventDefault()
            navigate(target.id)
          }
        }
      } else if (event.key === 'Escape' && focus) {
        setFocus(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, focus])

  const title = SECTIONS.find((s) => s.id === section)?.label ?? 'Enhome'

  return (
    <ShellContext.Provider value={{ focus, setFocus }}>
    <div className={`shell${folded ? ' collapsed' : ''}${focus ? ' focus' : ''}`}>
      <TitleBar title={focus ? `${title} · modo enfoque (Esc para salir)` : title} />
      <nav className="sidebar" aria-hidden={focus || undefined}>
        <div className="brand">
          <Logo style={settings.style} />
          <span className="nav-label">Enhome</span>
        </div>
        <LanguageSwitcher locked={examLocked} />
        <button type="button" className="nav-item search-item" onClick={() => setPalette(true)} title="Buscar (Ctrl+K)">
          <Icon name="search" className="nav-icon" />
          <span className="nav-label">Buscar</span>
          <kbd className="nav-label">Ctrl K</kbd>
        </button>
        {SECTION_GROUPS.map((group, i) => (
          <div key={group.id} className="nav-group" role="group" aria-label={group.label}>
            {i > 0 && <span className="nav-group-label">{group.label}</span>}
            {SECTIONS.filter((s) => s.group === group.id).map((s) => (
              <NavItem
                key={s.id}
                section={s}
                shortcut={SECTIONS.indexOf(s) < 9 ? SECTIONS.indexOf(s) + 1 : null}
                current={section}
                examLocked={examLocked}
                onNavigate={navigate}
              />
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <span className={`status-dot${examLocked ? ' busy' : ''}`} aria-hidden="true" />
          <span className="nav-label">{examLocked ? 'Examen en curso' : 'Claude conectado'}</span>
          {!narrow && (
          <button
            type="button"
            className="icon-button collapse-button"
            aria-label={collapsed ? 'Mostrar la barra lateral' : 'Plegar la barra lateral'}
            title={`${collapsed ? 'Mostrar' : 'Plegar'} la barra (Ctrl+B)`}
            onClick={() => setCollapsed(!collapsed)}
          >
            <Icon name="chevron" className="glyph" />
          </button>
          )}
        </div>
      </nav>
      {palette && <CommandPalette navigate={navigate} onClose={() => setPalette(false)} />}
      <WelcomeTour />
      {version && <WhatsNew version={version} />}
      <RewardToasts trigger={section} />
      <main className="content">
        <div key={section} className="page">
          <Suspense fallback={<p className="muted">Cargando…</p>}>
            <Page section={section} params={params} status={status} navigate={navigate} onExamLock={setExamLocked} />
          </Suspense>
        </div>
      </main>
    </div>
    </ShellContext.Provider>
  )
}

function Page({
  section,
  params,
  status,
  navigate,
  onExamLock
}: {
  section: SectionId
  params: NavParams
  status: ReadyStatus
  navigate: Navigate
  onExamLock: (locked: boolean) => void
}): React.JSX.Element {
  if (section === 'inicio') return <Home navigate={navigate} />
  if (section === 'temario') return <Curriculum focusTopicId={params.topicId ?? null} />
  if (section === 'practica') return <Practice navigate={navigate} />
  if (section === 'repaso') return <Review examId={params.examId ?? null} navigate={navigate} />
  if (section === 'juegos') return <Games />
  if (section === 'lecturas') return <Readings />
  if (section === 'diario') return <Journal />
  if (section === 'ayuda') return <Help navigate={navigate} />
  if (section === 'estadisticas') return <Stats />
  if (section === 'biblioteca') return <Library />
  if (section === 'charla') return <Chat />
  if (section === 'resumenes') return <Summaries />
  if (section === 'pruebas') return <Tests navigate={navigate} onLockChange={onExamLock} />
  if (section === 'progreso') return <Progress navigate={navigate} />
  if (section === 'comentarios') return <Comments />
  if (section === 'acerca') return <About status={status} navigate={navigate} />
  return <Settings status={status} />
}

function NavItem({
  section,
  shortcut,
  current,
  examLocked,
  onNavigate
}: {
  section: (typeof SECTIONS)[number]
  shortcut: number | null
  current: SectionId
  examLocked: boolean
  onNavigate: Navigate
}): React.JSX.Element {
  const blocked = examLocked && section.id !== 'pruebas'
  return (
    <button
      className="nav-item"
      aria-current={section.id === current ? 'page' : undefined}
      disabled={blocked}
      title={blocked ? 'Entregá el examen para salir de Pruebas' : shortcut ? `${section.label} (Ctrl+${shortcut})` : section.label}
      onClick={() => onNavigate(section.id)}
    >
      <Icon name={section.id} className="nav-icon" />
      <span className="nav-label">{section.label}</span>
    </button>
  )
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent): void => setMatches(e.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}
