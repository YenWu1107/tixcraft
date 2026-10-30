import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { EventsProvider } from './context/EventsContext'
import { PurchaseProvider } from './context/PurchaseContext'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EventsProvider>
          <PurchaseProvider>
            <App />
          </PurchaseProvider>
        </EventsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
