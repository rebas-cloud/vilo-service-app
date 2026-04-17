import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Silence React's default error logging for error boundary tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render fallback UI when child throws an error', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByText('Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu.')).toBeInTheDocument();
  });

  it('should display reload button in error state', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Seite neu laden/i });
    expect(reloadButton).toBeInTheDocument();
  });

  it('should have correct styling on error container', () => {
    const ThrowingComponent = () => {
      throw new Error('Test error');
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    const errorDiv = container.querySelector('div');
    expect(errorDiv).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: '#1a1a2e',
      color: '#e0e0f0',
    });
  });

  it('should log error to console when componentDidCatch is called', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    const ThrowingComponent = () => {
      throw new Error('Test error message');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    const calls = consoleErrorSpy.mock.calls;
    expect(calls.some(call => call[0]?.includes('[VILO]'))).toBe(true);
  });

  it('should render multiple children without error', () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
  });

  it('should handle nested content with complex structure', () => {
    render(
      <ErrorBoundary>
        <div>
          <h1>Header</h1>
          <p>Paragraph</p>
        </div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
  });
});
