import './style.css'

function LoginButton() {
    function doLogin(){

    }

    function handleClick() {
        doLogin();
        alert('You clicked me!');
    }

    return (
        <button id="login-btn" onClick={handleClick}>
        Sign In
        </button>
    );
}

export function LoginForm() {
    return (
        <div id="login-screen">
            <div class="login-box">
                <h2><span class="pink-sq"></span> Scrapy</h2>
                <p>Sign in to access the dashboard</p>
                <label for="username">Username</label>
                <input type="text" id="username" autocomplete="username" placeholder="username"/>
                <label for="password">Password</label>
                <input type="password" id="password" autocomplete="current-password" placeholder="••••••••"/>
                <LoginButton/>
                <div id="login-error"></div>
            </div>
        </div>
    );
}

export default LoginForm