import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { clearToken, loadToken, saveToken } from './api'
import { AuthForm } from './AuthForm'
import { MaintenanceRecordsPage } from './MaintenanceRecordsPage'

function App() {
  const [token, setToken] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setToken(loadToken())
    setInitialized(true)
  }, [])

  function handleAuthenticated(newToken: string) {
    saveToken(newToken)
    setToken(newToken)
  }

  const handleLoggedOut = useCallback(() => {
    clearToken()
    setToken(null)
  }, [])

  return (
    <main>
      <h1>バイク整備記録</h1>
      {initialized &&
        (token === null ? (
          <AuthForm onAuthenticated={handleAuthenticated} />
        ) : (
          <MaintenanceRecordsPage token={token} onLoggedOut={handleLoggedOut} />
        ))}
    </main>
  )
}

export default App
