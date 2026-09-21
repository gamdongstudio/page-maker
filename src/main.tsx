import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProjectProvider } from './store/ProjectStore';
import { EditionProvider } from './store/EditionContext';
import './styles/app.css';
import { startPmConnectLife } from './services/import/pmConnectLife';
import { PM_CONNECT_ENABLED } from './config/baroduTools';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EditionProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </EditionProvider>
  </React.StrictMode>,
);

/* PM Connect 를 PageMaker 와 함께 켜고, PageMaker 를 닫으면 PM Connect 도 스스로 끝나게 한다 */
if (PM_CONNECT_ENABLED) startPmConnectLife();
