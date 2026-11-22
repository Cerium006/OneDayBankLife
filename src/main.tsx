import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка интерфейса.';
    return { hasError: true, message };
  }

  handleResetAndReload = () => {
    try {
      window.localStorage.removeItem('bank_day_sim_save_v1');
      window.localStorage.removeItem('bank_day_sim_tutorial_v1');
    } catch {
      // Игнорируем ошибку доступа к localStorage в приватном режиме
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#2A2A2A',
            color: '#F7F4EE',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              backgroundColor: '#333734',
              border: '1px solid #585858',
              borderRadius: '10px',
            }}
          >
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FCA5A5' }}>
              Не удалось запустить экран игры
            </h1>
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#E9C69C' }}>
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleResetAndReload}
              style={{
                marginTop: '16px',
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: 600,
                backgroundColor: '#00B849',
                color: '#141A14',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Сбросить кэш смены и перезагрузить
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
