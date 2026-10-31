import { useEffect, useState } from 'react';
import { getCurrentUser, logOut } from './storage';
import AuthPage from './AuthPage';
import Home from './Home';
import Leaderboard from './Leaderboard';
import Admin from './Admin';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [route, setRoute] = useState(() => {
    const path = (window.location.pathname || '').toLowerCase();
    const search = new URLSearchParams(window.location.search);
    if (path.includes('leaderboard') || search.get('view') === 'leaderboard') return 'leaderboard';
    if (path.includes('admin') || search.get('view') === 'admin') return 'admin';
    return 'portal';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const search = new URLSearchParams(window.location.search);
      if (path.includes('leaderboard') || search.get('view') === 'leaderboard') setRoute('leaderboard');
      else if (path.includes('admin') || search.get('view') === 'admin') setRoute('admin');
      else setRoute('portal');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check if someone is already logged in when the page opens
  useEffect(() => {
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });
  }, []);

  async function handleLogout() {
    await logOut();
    setUser(null);
  }

  if (route === 'leaderboard') {
    return <Leaderboard />;
  }

  if (route === 'admin') {
    return <Admin />;
  }

  if (checking) {
    return (
      <div className="auth-page">
        <span className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={setUser} />;
  }

  return <Home user={user} onLogout={handleLogout} />;
}