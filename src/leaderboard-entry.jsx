import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Leaderboard from './Leaderboard.jsx';

createRoot(document.getElementById('leaderboard-root')).render(
  <StrictMode>
    <Leaderboard />
  </StrictMode>
);
