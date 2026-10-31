import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Admin from './Admin.jsx';

createRoot(document.getElementById('admin-root')).render(
  <StrictMode>
    <Admin />
  </StrictMode>
);
