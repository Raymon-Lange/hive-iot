import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import Overview from './pages/Overview.jsx'
import DeviceDetail from './pages/DeviceDetail.jsx'
import FirmwareManagement from './pages/FirmwareManagement.jsx'

function App() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <div className="app">
      <header className="app-header">
        <span className="name">Hive IoT</span>
        <nav>
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/firmware">Firmware</NavLink>
        </nav>
        <div className="header-right">
          <button
            id="theme-toggle"
            aria-label="Toggle dark mode"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          />
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
          <Route path="/firmware" element={<FirmwareManagement />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
