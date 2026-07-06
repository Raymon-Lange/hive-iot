import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDevices, registerDevice } from '../api.js'

export default function Overview() {
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState(null)
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null)

  async function load() {
    try {
      const data = await listDevices()
      setDevices(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  async function handleRegister(e) {
    e.preventDefault()
    if (!deviceId || !name) return
    setStatus(null)
    try {
      await registerDevice(deviceId, name)
      setDeviceId('')
      setName('')
      await load()
      setStatus({ type: 'ok', message: `Registered ${deviceId}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  return (
    <div>
      <div className="card">
        <h3>Register a device</h3>
        <form className="stacked" onSubmit={handleRegister}>
          <label>
            Device ID
            <input
              type="text"
              placeholder="thermostat-002"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
            />
          </label>
          <label>
            Name
            <input
              type="text"
              placeholder="Bedroom Thermostat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button type="submit">Register</button>
        </form>
        {status && (
          <p className={status.type === 'error' ? 'error' : 'muted'}>{status.message}</p>
        )}
      </div>

      {error && <p className="error">Failed to load devices: {error}</p>}
      {devices === null && !error && <p className="muted">Loading devices…</p>}
      {devices !== null && devices.length === 0 && (
        <p className="muted">No devices registered or connected yet.</p>
      )}
      {devices !== null && devices.length > 0 && (
        <div>
          <h2>Devices ({devices.length})</h2>
          <div className="device-list">
            {devices.map((d) => (
              <Link key={d.deviceId} to={`/devices/${d.deviceId}`} className="device-row">
                <div>
                  <strong>{d.name || d.deviceId}</strong>
                  {d.name && <div className="muted">{d.deviceId}</div>}
                </div>
                <div className="temp">
                  {d.temperature != null ? `${d.temperature.toFixed(1)}°F` : '—'}
                </div>
                <div>
                  <div className="muted">Firmware: {d.firmware || '—'}</div>
                  <div className="muted">
                    Last reported: {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'never'}
                  </div>
                  <span className={`badge ${d.online ? 'online' : 'offline'}`}>
                    {d.online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
