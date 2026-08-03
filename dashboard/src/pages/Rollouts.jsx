import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRollout, listDevices, listFirmware, listRollouts } from '../api.js'
import StatusMessage from '../components/StatusMessage.jsx'

function parseTimestamp(ts) {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC, no offset.
  return new Date(ts.replace(' ', 'T') + 'Z')
}

export default function Rollouts() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [firmwareList, setFirmwareList] = useState([])
  const [rollouts, setRollouts] = useState(null)
  const [error, setError] = useState(null)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState(new Set())
  const [selectedVersion, setSelectedVersion] = useState('')
  const [bakeMinutes, setBakeMinutes] = useState(10)
  const [status, setStatus] = useState(null)

  async function load() {
    try {
      const [dev, fw, ro] = await Promise.all([listDevices(), listFirmware(), listRollouts()])
      setDevices(dev)
      setFirmwareList(fw)
      setRollouts(ro)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  function toggleDevice(deviceId) {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (selectedDeviceIds.size === 0 || !selectedVersion) return
    setStatus(null)
    try {
      const rollout = await createRollout(selectedVersion, Array.from(selectedDeviceIds), Number(bakeMinutes))
      setSelectedDeviceIds(new Set())
      setSelectedVersion('')
      setBakeMinutes(10)
      navigate(`/rollouts/${rollout.id}`)
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  const activeRollout = rollouts?.find((r) => r.status === 'baking')

  return (
    <div>
      <h2>Canary Rollouts</h2>
      <p className="muted">
        Push a firmware version to a hand-picked set of devices first, watch their
        health during a bake period, then promote to the rest of the fleet.
      </p>

      <StatusMessage status={status} onClose={() => setStatus(null)} />

      <div className="card">
        <h3>New rollout</h3>
        {activeRollout ? (
          <p className="muted">
            A rollout is already in progress (
            <Link to={`/rollouts/${activeRollout.id}`}>#{activeRollout.id}</Link>) — only one
            rollout can be active at a time.
          </p>
        ) : devices.length === 0 || firmwareList.length === 0 ? (
          <p className="muted">Need at least one device and one uploaded firmware version.</p>
        ) : (
          <form className="stacked" onSubmit={handleCreate}>
            <label>
              Firmware version
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a version
                </option>
                {firmwareList.map((f) => (
                  <option key={f.filename} value={f.version}>
                    {f.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bake minutes
              <input
                type="number"
                min="1"
                value={bakeMinutes}
                onChange={(e) => setBakeMinutes(e.target.value)}
                required
              />
            </label>
            <fieldset>
              <legend>Canary devices</legend>
              {devices.map((d) => (
                <label key={d.deviceId} style={{ display: 'block', fontWeight: 'normal' }}>
                  <input
                    type="checkbox"
                    checked={selectedDeviceIds.has(d.deviceId)}
                    onChange={() => toggleDevice(d.deviceId)}
                  />{' '}
                  {d.name || d.deviceId} <span className="muted">({d.firmware ?? 'unknown'})</span>
                </label>
              ))}
            </fieldset>
            <button type="submit">Start canary rollout</button>
          </form>
        )}
      </div>

      {error && <p className="error">Failed to load rollouts: {error}</p>}
      {rollouts === null && !error && <p className="muted">Loading rollouts…</p>}
      {rollouts !== null && rollouts.length === 0 && (
        <p className="muted">No rollouts yet.</p>
      )}
      {rollouts !== null && rollouts.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Version</th>
              <th>Devices</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rollouts.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/rollouts/${r.id}`}>#{r.id}</Link>
                </td>
                <td>{r.firmwareVersion}</td>
                <td>{r.deviceCount}</td>
                <td>
                  <span className={`badge ${r.status === 'promoted' ? 'online' : r.status === 'failed' ? 'offline' : ''}`}>
                    {r.status}
                  </span>
                </td>
                <td>{parseTimestamp(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
