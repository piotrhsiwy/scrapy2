import './style.css'
import { useState } from 'react';

function LoginButton({loading}) {

    return (
        <button id="login-btn" type="submit">
            {loading ? 'Signing In...' : 'Sign In'}
        </button>
    );
}
    
export function LoginForm({setIsLoggedIn, setUsername, errorMessage, setErrorMessage}) {

    const [password, setPassword] = useState('');
    const [localUsername, setLocalUsername] = useState('');

    const [loading, setLoading] = useState(false);

    async function handleSubmit(){
        setLoading(true);

        if(!localUsername || !password){
            setErrorMessage('Please enter username and password.');
            setLoading(false);
            return;    
        } 

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ localUsername, password })
            });
            
            if (res.ok) {
                setIsLoggedIn(true);
                setUsername(localUsername)
            } else {
                setErrorMessage('Invalid username or password.');
            }
        } catch {
            setErrorMessage('Connection error. Try again.');
        } finally {
            setLoading(false);
        }
    }


    return (
        <div id="login-screen">
            <div className="login-box">
                <h2><span className="pink-sq"></span> Scrapy</h2>
                <p>Sign in to access the dashboard</p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="username">Username</label>
                    <input 
                        type="text" 
                        id="username" 
                        autoComplete="username" 
                        placeholder="username"
                        value={localUsername}
                        onChange={e => setLocalUsername(e.target.value)}
                    />

                    <label htmlFor="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        autoComplete="current-password" 
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />

                    <LoginButton loading={loading}/>
                </form>

                <div id="login-error">
                    {errorMessage}
                </div>
            </div>
        </div>
    );
}

export default LoginForm