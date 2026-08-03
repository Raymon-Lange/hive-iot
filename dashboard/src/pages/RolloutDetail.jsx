import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getRollout, promoteRollout } from '../api.js'
import StatusMessage from '../components/StatusMessage.jsx'

function parseTimestamp(ts) {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC, no offset.
  return new Date(ts.replace(' ', 'T') + 'Z')
}

function formatCountdown(ms) {
  if (ms <= 0) return 'bake period complete'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s remaining`
}

function deviceBadge(status) {
  if (status === 'updated') return <span className="badge online">Healthy</span>
  if (status === 'failed') return <span className="badge offline">Failed / Reverted</span>
  return <span className="muted">Pending</span>
}

export default function RolloutDetail() {
  const { rolloutId } = useParams()
  const [rollout, setRollout] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getRollout(rolloutId)
        if (!cancelled) setRollout(data)
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
  }, [rolloutId])

  async function handlePromote() {
    setStatus(null)
    setPromoting(true)
    try {
      const updated = await promoteRollout(rolloutId)
      setRollout(updated)
      setStatus({ type: 'ok', message: 'Promoted to the rest of the fleet.' })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setPromoting(false)
    }
  }

  if (error) return <p className="error">Failed to load rollout: {error}</p>
  if (rollout === null) return <p className="muted">Loading…</p>

  const bakeEndsAt = parseTimestamp(rollout.bakeEndsAt)
  const countdown = formatCountdown(bakeEndsAt - Date.now())

  return (
    <div>
      <h2>Rollout #{rollout.id}</h2>
      <span
        className={`badge ${
          rollout.status === 'promoted' ? 'online' : rollout.status === 'failed' ? 'offline' : ''
        }`}
      >
        {rollout.status}
      </span>

      <StatusMessage status={status} onClose={() => setStatus(null)} />

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="label">Target version</div>
          <div className="value">{rollout.firmwareVersion}</div>
        </div>
        <div className="stat">
          <div className="label">Bake period</div>
          <div className="value" style={{ fontSize: 15 }}>
            {rollout.bakeMinutes}m — {rollout.status === 'baking' ? countdown : 'ended'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Created</div>
          <div className="value" style={{ fontSize: 15 }}>
            {parseTimestamp(rollout.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Canary devices</h3>
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Previous version</th>
              <th>Current firmware</th>
              <th>Status</th>
              <th>Online</th>
            </tr>
          </thead>
          <tbody>
            {rollout.devices.map((d) => (
              <tr key={d.deviceId}>
                <td>{d.deviceId}</td>
                <td>{d.previousVersion}</td>
                <td>{d.currentFirmware ?? '—'}</td>
                <td>{deviceBadge(d.status)}</td>
                <td>
                  <span className={`badge ${d.online ? 'online' : 'offline'}`}>
                    {d.online ? 'Online' : 'Offline'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rollout.status === 'failed' && (
        <p className="error" style={{ marginTop: 16 }}>
          One or more canary devices failed and were automatically reverted to their
          previous firmware version. This rollout is blocked from promotion.
        </p>
      )}

      {rollout.status === 'baking' && (
        <button
          type="button"
          disabled={!rollout.readyToPromote || promoting}
          onClick={handlePromote}
          style={{ marginTop: 16 }}
        >
          {rollout.readyToPromote
            ? `Promote to all remaining devices`
            : `Waiting on bake period / canary health…`}
        </button>
      )}
    </div>
  )
}
