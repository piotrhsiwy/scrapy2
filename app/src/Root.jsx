import { useState } from 'react';

import './index.css'
import { lazy } from 'react';
const App = lazy( () => import( './App.jsx' ));
import LoginForm from './LoginForm.jsx'

export function Root() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [username, setUsername] = useState('');

  return (
    <>
      {isLoggedIn
          ? <App 
            setIsLoggedIn={setIsLoggedIn}
            username={username}
            setErrorMessage={setErrorMessage}
          />
          : <LoginForm 
            setIsLoggedIn={setIsLoggedIn} 
            setUsername={setUsername}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
          />
      }
    </>
  );
}

export default Root