import React from 'react';
import Auth from './components/Auth';
import Store from './components/Store';

function App() {
  return (
    <div className="App">
      <Auth />
      <Store />
    </div>
  );
}
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import StorePage from './pages/StorePage';

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/store" element={<StorePage />} />
            </Routes>
        </Router>
    );
};

export default App;
