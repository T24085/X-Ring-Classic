import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Set branded background and pointer assets dynamically so local development and
// the GitHub Pages deployment both resolve them from the correct base path.
const publicPath = process.env.PUBLIC_URL || '/X-Ring-Classic';
const bgStyle = document.createElement('style');
bgStyle.textContent = `
  body {
    background-color: #ffffff;
    background-image: url('${publicPath}/gunguys-logo-black.png');
  }
`;
document.head.appendChild(bgStyle);

const brandInteractionStyle = document.createElement('style');
brandInteractionStyle.textContent = `
  @media (pointer: fine) {
    html,
    body,
    a,
    button,
    [role="button"] {
      cursor: url('${publicPath}/x-ring-classic-cursor.png') 8 8, crosshair;
    }

    input,
    textarea {
      cursor: text;
    }

    select {
      cursor: pointer;
    }
  }
`;
document.head.appendChild(brandInteractionStyle);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={process.env.PUBLIC_URL || '/X-Ring-Classic'}>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
