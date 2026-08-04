const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8010'

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function listDevices() {
  return request('/devices')
}

export function registerDevice(deviceId, name) {
  return request('/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, name }),
  })
}

export function getTwin(deviceId) {
  return request(`/devices/${deviceId}/twin`)
}

export function getTelemetry(deviceId, range = '1h') {
  return request(`/devices/${deviceId}/telemetry?range=${range}`)
}

export function setDesired(deviceId, desired) {
  return request(`/devices/${deviceId}/desired`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(desired),
  })
}

export function listFirmware() {
  return request('/firmware')
}

export function uploadFirmware(version, file) {
  const formData = new FormData()
  formData.append('version', version)
  formData.append('file', file)
  return request('/firmware', { method: 'POST', body: formData })
}

export function listRollouts() {
  return request('/rollouts')
}

export function getRollout(rolloutId) {
  return request(`/rollouts/${rolloutId}`)
}

export function createRollout(firmwareVersion, deviceIds, bakeMinutes) {
  return request('/rollouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firmwareVersion, deviceIds, bakeMinutes }),
  })
}

export function promoteRollout(rolloutId) {
  return request(`/rollouts/${rolloutId}/promote`, { method: 'POST' })
}
