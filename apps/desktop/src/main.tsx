import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClipboardWindowApp } from './components/ClipboardWindowApp.tsx'

const isClipboardWindow =
  new URLSearchParams(window.location.search).get('window') === 'clipboard';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isClipboardWindow ? <ClipboardWindowApp /> : <App />}
  </StrictMode>,
)
