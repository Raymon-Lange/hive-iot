import { useEffect, useState } from 'react'
import { listDevices, listFirmware, setDesired, uploadFirmware } from '../api.js'

export default function FirmwareManagement() {
  const [firmwareList, setFirmwareList] = useState(null)
  const [devices, setDevices] = useState([])
  const [version, setVersion] = useState('')
  const [file, setFile] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [status, setStatus] = useState(null)

  async function refresh() {
    const [fw, dev] = await Promise.all([listFirmware(), listDevices()])
    setFirmwareList(fw)
    setDevices(dev)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!version || !file) return
    setStatus(null)
    try {
      await uploadFirmware(version, file)
      setVersion('')
      setFile(null)
      e.target.reset()
      await refresh()
      setStatus({ type: 'ok', message: `Uploaded firmware ${version}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  async function handlePush(e) {
    e.preventDefault()
    if (!selectedDevice || !selectedVersion) return
    setStatus(null)
    try {
      await setDesired(selectedDevice, { firmware: selectedVersion })
      setStatus({
        type: 'ok',
        message: `Set desired firmware ${selectedVersion} on ${selectedDevice}. Note: the device doesn't install it yet — OTA isn't wired up on the firmware side.`,
      })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  return (
    <div>
      <h2>Firmware Management</h2>
      <p className="muted">
        Upload a firmware build and push a desired version to a device. This
        only sets the twin's desired state — devices don't download or
        install firmware yet.
      </p>

      {status && (
        <p className={status.type === 'error' ? 'error' : 'muted'}>{status.message}</p>
      )}

      <div className="card">
        <h3>Upload firmware</h3>
        <form className="stacked" onSubmit={handleUpload}>
          <label>
            Version
            <input
              type="text"
              placeholder="1.0.1"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
          </label>
          <label>
            Firmware binary
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              required
            />
          </label>
          <button type="submit">Upload</button>
        </form>
      </div>

      <div className="card">
        <h3>Push to device</h3>
        {devices.length === 0 || !firmwareList || firmwareList.length === 0 ? (
          <p className="muted">Need at least one device and one uploaded firmware version.</p>
        ) : (
          <form className="stacked" onSubmit={handlePush}>
            <label>
              Device
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a device
                </option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceId}
                  </option>
                ))}
              </select>
            </label>
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
            <button type="submit">Push desired version</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>Available firmware</h3>
        {firmwareList === null ? (
          <p className="muted">Loading…</p>
        ) : firmwareList.length === 0 ? (
          <p className="muted">No firmware uploaded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Filename</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {firmwareList.map((f) => (
                <tr key={f.filename}>
                  <td>{f.version}</td>
                  <td>{f.filename}</td>
                  <td>{new Date(f.uploadedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
