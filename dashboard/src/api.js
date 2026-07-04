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

export function getTwin(deviceId) {
  return request(`/devices/${deviceId}/twin`)
}

export function getTelemetry(deviceId, limit = 100) {
  return request(`/devices/${deviceId}/telemetry?limit=${limit}`)
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
