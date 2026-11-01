import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { workspaceStorage } from './utils/workspaceStorage';

void workspaceStorage.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
});
