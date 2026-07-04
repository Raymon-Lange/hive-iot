import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDevices } from '../api.js'

export default function Overview() {
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await listDevices()
        if (!cancelled) setDevices(data)
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
  }, [])

  if (error) return <p className="error">Failed to load devices: {error}</p>
  if (devices === null) return <p className="muted">Loading devices…</p>
  if (devices.length === 0) {
    return <p className="muted">No devices have connected yet.</p>
  }

  return (
    <div>
      <h2>Devices ({devices.length})</h2>
      <div className="device-list">
        {devices.map((d) => (
          <Link key={d.deviceId} to={`/devices/${d.deviceId}`} className="device-row">
            <div>
              <strong>{d.deviceId}</strong>
              <div className="muted">
                Last seen: {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'never'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>{d.temperature != null ? `${d.temperature.toFixed(1)}°F` : '—'}</div>
              <span className={`badge ${d.online ? 'online' : 'offline'}`}>
                {d.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
