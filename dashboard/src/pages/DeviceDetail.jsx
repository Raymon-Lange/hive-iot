import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getTelemetry, getTwin, setDesired } from '../api.js'
import TemperatureChart from '../components/TemperatureChart.jsx'
import StatusMessage from '../components/StatusMessage.jsx'

const MODES = ['idle', 'cool', 'heat']
const SENSOR_MODES = ['sim', 'phy']

export default function DeviceDetail() {
  const { deviceId } = useParams()
  const [twin, setTwin] = useState(null)
  const [telemetry, setTelemetry] = useState(null)
  const [error, setError] = useState(null)
  const [tempInput, setTempInput] = useState('')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

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

  async function handleSetMode(mode) {
    setSaving(true)
    setStatus(null)
    try {
      const { desired } = await setDesired(deviceId, { mode })
      setTwin((t) => (t ? { ...t, desired } : t))
      setStatus({ type: 'ok', message: `Mode set to ${mode}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleSetSensorMode(sensorMode) {
    setSaving(true)
    setStatus(null)
    try {
      const { desired } = await setDesired(deviceId, { sensorMode })
      setTwin((t) => (t ? { ...t, desired } : t))
      setStatus({ type: 'ok', message: `Sensor source set to ${sensorMode.toUpperCase()}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleSetTemp(e) {
    e.preventDefault()
    if (tempInput === '') return
    setSaving(true)
    setStatus(null)
    try {
      const { desired } = await setDesired(deviceId, { temp: Number(tempInput) })
      setTwin((t) => (t ? { ...t, desired } : t))
      setStatus({ type: 'ok', message: `Desired temp set to ${tempInput}°F` })
      setTempInput('')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

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
        <h3>Controls</h3>
        <div className="stacked">
          <div>
            <div className="muted">Mode {desired.mode ? `(desired: ${desired.mode})` : ''}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSetMode(mode)}
                  className={desired.mode === mode ? 'active' : ''}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted">
              Sensor source {desired.sensorMode ? `(desired: ${desired.sensorMode})` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {SENSOR_MODES.map((sensorMode) => (
                <button
                  key={sensorMode}
                  type="button"
                  disabled={saving}
                  onClick={() => handleSetSensorMode(sensorMode)}
                  className={desired.sensorMode === sensorMode ? 'active' : ''}
                >
                  {sensorMode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <form className="stacked" onSubmit={handleSetTemp} style={{ marginTop: 12 }}>
            <label>
              Desired temp {desired.temp != null ? `(current: ${desired.temp}°F)` : ''}
              <input
                type="number"
                placeholder="72"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
              />
            </label>
            <button type="submit" disabled={saving || tempInput === ''}>
              Set desired temp
            </button>
          </form>
        </div>
        <StatusMessage status={status} onClose={() => setStatus(null)} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Digital Twin</h3>
        <pre className="twin-json">{JSON.stringify({ reported, desired }, null, 2)}</pre>
      </div>
    </div>
  )
}
