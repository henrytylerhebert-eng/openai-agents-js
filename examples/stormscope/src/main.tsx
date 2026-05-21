import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import StormScope from './StormScope';
import { initAgents } from './agents';
import { initAirtable } from './airtable';

initAgents(import.meta.env.VITE_OPENAI_API_KEY || '');
initAirtable(import.meta.env.VITE_AIRTABLE_TOKEN || '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StormScope />
  </StrictMode>,
);
