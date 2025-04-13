import React, { useState } from 'react';
import { registerUser, loginUser } from '../services/api';

const AuthPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleRegister = async () => {
        await registerUser({ email, password });
    };

    const handleLogin = async () => {
        await loginUser({ email, password });
    };

    return (
        <div>
            <h2>Sign Up or Log In</h2>
            <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
            <button onClick={handleRegister}>Sign Up</button>
            <button onClick={handleLogin}>Log In</button>
            <button onClick={() => window.location.href = '/oauth/google'}>Log In with Google</button>
        </div>
    );
};

export default AuthPage;
