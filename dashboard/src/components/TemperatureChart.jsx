import { useMemo, useState } from 'react'

const WIDTH = 640
const HEIGHT = 220
const MARGIN = { top: 16, right: 56, bottom: 28, left: 40 }
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom

function parseTimestamp(ts) {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC, no offset.
  return new Date(ts.replace(' ', 'T') + 'Z')
}

function niceTicks(min, max, count = 4) {
  if (min === max) {
    min -= 1
    max += 1
  }
  const rawStep = (max - min) / count
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks = []
  for (let t = niceMin; t <= niceMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100)
  }
  return ticks
}

export default function TemperatureChart({ data }) {
  const [view, setView] = useState('chart')
  const [hoverIndex, setHoverIndex] = useState(null)

  const points = useMemo(
    () =>
      data.map((d) => ({
        temperature: d.temperature,
        date: parseTimestamp(d.timestamp),
        raw: d,
      })),
    [data],
  )

  const yTicks = useMemo(() => {
    if (points.length === 0) return []
    const temps = points.map((p) => p.temperature)
    return niceTicks(Math.min(...temps), Math.max(...temps))
  }, [points])

  if (data.length === 0) {
    return (
      <figure className="chart-card viz-root">
        <figcaption>
          <h3>Temperature history</h3>
        </figcaption>
        <p className="chart-empty">No telemetry yet.</p>
      </figure>
    )
  }

  const yMin = yTicks[0]
  const yMax = yTicks[yTicks.length - 1]
  const n = points.length

  const xScale = (i) => MARGIN.left + (n === 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W)
  const yScale = (temp) => MARGIN.top + (1 - (temp - yMin) / (yMax - yMin)) * PLOT_H

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)},${yScale(p.temperature)}`)
    .join(' ')

  const last = points[n - 1]
  const hovered = hoverIndex != null ? points[hoverIndex] : null

  function handlePointerMove(e) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const scale = WIDTH / rect.width
    const x = (e.clientX - rect.left) * scale
    const t = Math.min(1, Math.max(0, (x - MARGIN.left) / PLOT_W))
    const i = Math.round(t * (n - 1))
    setHoverIndex(Math.min(n - 1, Math.max(0, i)))
  }

  const xLabelIdx = n === 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1]

  return (
    <figure className="chart-card viz-root">
      <figcaption>
        <h3>Temperature history</h3>
        <button
          type="button"
          className="chart-toggle"
          onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
        >
          {view === 'chart' ? 'View as table' : 'View as chart'}
        </button>
      </figcaption>

      {view === 'table' ? (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Temperature</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.date.toLocaleString()}</td>
                <td>{p.temperature.toFixed(1)}°F</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg
            className="chart-svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={yScale(t)}
                  y2={yScale(t)}
                  stroke="var(--viz-grid)"
                  strokeWidth="1"
                />
                <text
                  x={MARGIN.left - 8}
                  y={yScale(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="var(--viz-muted)"
                >
                  {t}°
                </text>
              </g>
            ))}

            {xLabelIdx.map((i) => (
              <text
                key={i}
                x={xScale(i)}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize="11"
                fill="var(--viz-muted)"
              >
                {points[i].date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </text>
            ))}

            <path
              d={linePath}
              fill="none"
              stroke="var(--viz-series-1)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <circle
              cx={xScale(n - 1)}
              cy={yScale(last.temperature)}
              r="5"
              fill="var(--viz-series-1)"
              stroke="var(--viz-surface)"
              strokeWidth="2"
            />
            <text
              x={xScale(n - 1) + 8}
              y={yScale(last.temperature)}
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="600"
              fill="var(--viz-text-primary)"
            >
              {last.temperature.toFixed(1)}°F
            </text>

            {hovered && (
              <g>
                <line
                  x1={xScale(hoverIndex)}
                  x2={xScale(hoverIndex)}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  stroke="var(--viz-baseline)"
                  strokeWidth="1"
                />
                <circle
                  cx={xScale(hoverIndex)}
                  cy={yScale(hovered.temperature)}
                  r="5"
                  fill="var(--viz-series-1)"
                  stroke="var(--viz-surface)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>

          {hovered && (
            <div
              className="chart-tooltip"
              style={{
                left: `${(xScale(hoverIndex) / WIDTH) * 100}%`,
                top: `${(yScale(hovered.temperature) / HEIGHT) * 100}%`,
              }}
            >
              <div>{hovered.date.toLocaleTimeString()}</div>
              <div className="value">{hovered.temperature.toFixed(1)}°F</div>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
