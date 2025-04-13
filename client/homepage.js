import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
    return (
        <div className="homepage">
            <h1>Welcome to [App Name]</h1>
            <p>Connect, create, and share with the world.</p>
            <div>
                <Link to="/signup"><button>Sign Up</button></Link>
                <Link to="/login"><button>Log In</button></Link>
            </div>
        </div>
    );
};

export default HomePage;
