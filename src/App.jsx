import { useEffect, useState } from 'react';
import { getCurrentUser, logOut } from './storage';
import AuthPage from './AuthPage';
import Home from './Home';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Check if someone is already logged in when the page opens
  useEffect(() => {
    getCurrentUser().then(currentUser => {
      setUser(currentUser);
      setChecking(false);
    });
  }, []);

  async function handleLogout() {
    await logOut();
    setUser(null);
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