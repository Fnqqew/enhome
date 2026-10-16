import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CertificateView } from '@shared/certificates'
import type { CefrLevel } from '@shared/curriculum'
import { formatDayMonth } from '@shared/dates'
import Icon from '../Icon'

// Un certificado por nivel: al aprobar todos sus tópicos se puede ver el diploma y guardarlo en PDF.
export default function Certificates(): React.JSX.Element | null {
  const [list, setList] = useState<CertificateView[] | null>(null)
  const [preview, setPreview] = useState<{ level: CefrLevel; html: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getCertificates()
      .then(setList)
      .catch(() => setList([]))
  }, [])

  if (!list || list.length === 0) return null

  const open = (level: CefrLevel): void => {
    window.api
      .getCertificateHtml(level)
      .then((html) => setPreview({ level, html }))
      .catch((err: Error) => setMessage(err.message))
  }

  const save = (level: CefrLevel): void => {
    setMessage(null)
    window.api
      .saveCertificatePdf(level)
      .then((path) => path && setMessage(`Guardado en ${path}`))
      .catch((err: Error) => setMessage(err.message))
  }

  return (
    <section className="card wide stack">
      <h2>Certificados</h2>
      <div className="certificates">
        {list.map((c) => (
          <div key={c.level} className={`certificate${c.complete ? ' complete' : ''}`}>
            <Icon name={c.complete ? 'medal' : 'cap'} className="certificate-icon" />
            <div className="stack-sm">
              <strong>
                {c.level} · {c.levelName}
              </strong>
              {c.complete ? (
                <span className="muted small">
                  Completo{c.completedOn ? ` el ${formatDayMonth(c.completedOn)}` : ''} · promedio {c.average ?? '—'}
                </span>
              ) : (
                <>
                  <span className="muted small">
                    {c.passedTopics} de {c.totalTopics} tópicos aprobados
                  </span>
                  <div className="mini-progress" aria-label={`${c.passedTopics} de ${c.totalTopics}`}>
                    <span style={{ width: `${(c.passedTopics / c.totalTopics) * 100}%` }} />
                  </div>
                </>
              )}
            </div>
            {c.complete && (
              <div className="row">
                <button className="btn secondary" onClick={() => open(c.level)}>
                  Ver diploma
                </button>
                <button className="btn" onClick={() => save(c.level)}>
                  Guardar PDF
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {message && <p className="muted small">{message}</p>}
      {preview && (
        <div className="modal-backdrop" onMouseDown={() => setPreview(null)}>
          <div className="modal card stack diploma-modal" role="dialog" aria-modal="true" aria-label="Diploma" onMouseDown={(e) => e.stopPropagation()}>
            <DiplomaFrame level={preview.level} html={preview.html} />
            <div className="row">
              <button className="btn" onClick={() => save(preview.level)}>
                Guardar PDF
              </button>
              <button className="btn secondary" onClick={() => setPreview(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// La hoja mide 297 mm (unos 1123 px): en la vista previa se achica para que entre en el recuadro.
const SHEET_PX = 1123

function DiplomaFrame({ level, html }: { level: CefrLevel; html: string }): React.JSX.Element {
  const ref = useRef<HTMLIFrameElement>(null)
  const [zoom, setZoom] = useState(0.8)
  useLayoutEffect(() => {
    if (ref.current) setZoom(ref.current.clientWidth / SHEET_PX)
  }, [])
  const doc = html.replace('</head>', `<style>@media screen { html { zoom: ${zoom.toFixed(3)}; overflow: hidden; } }</style></head>`)
  return <iframe ref={ref} className="diploma-frame" title={`Certificado ${level}`} srcDoc={doc} sandbox="" />
}
