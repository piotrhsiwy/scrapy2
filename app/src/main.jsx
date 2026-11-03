import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginForm from './LoginForm.jsx'

const isLoggedIn = false;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div>
      {isLoggedIn ? (
        <App />
      ) : (
        <LoginForm />
      )}
    </div>
  </StrictMode>,
)
