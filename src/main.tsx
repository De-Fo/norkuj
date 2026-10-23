import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LangProvider } from './lib/lang'
import { CookieConsent } from './components/CookieConsent'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
      {/* Mounted at the root so every route (district, compare, auth...) shows the banner and loads GA after consent */}
      <CookieConsent />
    </LangProvider>
  </StrictMode>,
)