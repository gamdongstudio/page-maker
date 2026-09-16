import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProjectProvider } from './store/ProjectStore';
import { EditionProvider } from './store/EditionContext';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EditionProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </EditionProvider>
  </React.StrictMode>,
);
