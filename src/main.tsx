import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/ui.css';
import './styles/card.css';
import './styles/tables.css';
import './styles/doubler.css';

const container = document.getElementById('root');
if (!container) throw new Error('Element #root introuvable dans index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
