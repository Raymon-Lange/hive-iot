import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import Overview from './pages/Overview.jsx'
import DeviceDetail from './pages/DeviceDetail.jsx'
import FirmwareManagement from './pages/FirmwareManagement.jsx'
import Rollouts from './pages/Rollouts.jsx'
import RolloutDetail from './pages/RolloutDetail.jsx'

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
          <NavLink to="/rollouts">Rollouts</NavLink>
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
          <Route path="/rollouts" element={<Rollouts />} />
          <Route path="/rollouts/:rolloutId" element={<RolloutDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
