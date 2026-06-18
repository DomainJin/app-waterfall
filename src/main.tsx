import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { PreviewWindow } from './ui/PreviewWindow';
import './styles/global.css';

// The same renderer bundle serves both windows; the preview window is
// loaded at the `#preview` route by the Electron main process.
const isPreview = window.location.hash.replace('#', '') === 'preview';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isPreview ? <PreviewWindow /> : <App />}</React.StrictMode>,
);
