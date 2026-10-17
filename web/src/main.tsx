import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ApiProvider, createApiFromEnv } from './api/client'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider api={createApiFromEnv()}>
      <App />
    </ApiProvider>
  </StrictMode>,
)
