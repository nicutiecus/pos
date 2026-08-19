import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Provider } from 'react-redux';
import { store } from './store/index.ts';
import {registerSW} from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
     updateSW(true); // Force skipWaiting and activate new SW immediately
   },
   onOfflineReady() {
     console.log('App ready for offline use.');
   },
 });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store= {store}>
    <App />
    </Provider>
  </React.StrictMode>
)
