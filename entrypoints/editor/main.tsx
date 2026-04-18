import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@/assets/main.css';

console.log('main.tsx: Entrypoint execution started');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('main.tsx: React render called');
} catch (error) {
  console.error('main.tsx: Critical error during mount:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;">
      <h1>Critical Error</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
  }
}
