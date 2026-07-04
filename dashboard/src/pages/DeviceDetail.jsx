import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getTelemetry, getTwin } from '../api.js'
import TemperatureChart from '../components/TemperatureChart.jsx'

export default function DeviceDetail() {
  const { deviceId } = useParams()
  const [twin, setTwin] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [twinData, telemetryData] = await Promise.all([
          getTwin(deviceId),
          getTelemetry(deviceId, 50),
        ])
        if (!cancelled) {
          setTwin(twinData)
          setTelemetry(telemetryData)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    load()
    const interval = setInterval(load, 10000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [deviceId])

  if (error) return <p className="error">Failed to load device: {error}</p>
  if (twin === null || telemetry === null) return <p className="muted">Loading…</p>

  const { reported, desired, online, lastSeen } = twin

  return (
    <div>
      <h2>{deviceId}</h2>
      <span className={`badge ${online ? 'online' : 'offline'}`}>
        {online ? 'Online' : 'Offline'}
      </span>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Temperature</div>
          <div className="value">
            {reported.temperature != null ? `${reported.temperature.toFixed(1)}°F` : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Firmware</div>
          <div className="value">{reported.firmware ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">RSSI</div>
          <div className="value">{reported.rssi ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Last seen</div>
          <div className="value" style={{ fontSize: 15 }}>
            {lastSeen ? new Date(lastSeen).toLocaleString() : 'never'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <TemperatureChart data={telemetry} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Digital Twin</h3>
        <pre className="twin-json">{JSON.stringify({ reported, desired }, null, 2)}</pre>
      </div>
    </div>
  )
}
