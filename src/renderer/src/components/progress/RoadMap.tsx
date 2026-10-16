import type { CurriculumMap, TopicMapStatus } from '@shared/curriculum'
import type { IconName } from '@shared/icons'
import Icon from '../Icon'

type NodeStatus = TopicMapStatus | 'planned'

const NODE_ICON: Record<NodeStatus, IconName | null> = {
  passed: 'check',
  current: 'star',
  review: 'retry',
  locked: null,
  'not-started': null,
  planned: null
}

const NODE_LABEL: Record<NodeStatus, string> = {
  passed: 'Aprobado',
  current: 'En curso',
  review: 'Para repasar',
  locked: 'Bloqueado',
  'not-started': 'Sin empezar',
  planned: 'Planificado'
}

// Mapa del recorrido: cada nivel es un tramo del camino con sus tópicos como paradas.
export default function RoadMap({ map }: { map: CurriculumMap }): React.JSX.Element {
  return (
    <div className="roadmap">
      {map.levels.map((level) => {
        const nodes = level.available
          ? level.topics.map((t) => ({ key: t.id, title: t.title, status: t.status as NodeStatus, order: t.order }))
          : level.planned.map((p, i) => ({ key: `${level.level}-${i}`, title: p.title, status: 'planned' as NodeStatus, order: i + 1 }))
        if (nodes.length === 0) return null
        const passed = nodes.filter((n) => n.status === 'passed' || n.status === 'review').length

        return (
          <div key={level.level} className={`road-level${level.available ? '' : ' planned'}`} data-level={level.level}>
            <div className="road-level-title">
              <span className="level-code">{level.level}</span>
              <span>{level.name}</span>
              <span className="muted small">{level.available ? `${passed}/${nodes.length}` : 'próximamente'}</span>
            </div>
            <ol className="road">
              {nodes.map((node) => (
                <li key={node.key} className={`road-node ${node.status}`} title={`${node.title} · ${NODE_LABEL[node.status]}`}>
                  <span className="road-dot">{NODE_ICON[node.status] ? <Icon name={NODE_ICON[node.status]!} className="glyph" /> : node.order}</span>
                  <span className="road-label">{node.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}
