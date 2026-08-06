import { useEffect, useState } from 'react'
import './App.css'

type HealthStatus = 'checking' | 'connected' | 'unreachable'

function App() {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    fetch('/health')
      .then((res) => (res.ok ? setStatus('connected') : setStatus('unreachable')))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main>
      <h1>バイク整備記録</h1>
      <p>backend: {status}</p>
    </main>
  )
}

export default App
