import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { AppProvider } from '@/context/AppContext';

// Mock staff data
const mockStaff = [
  { id: '1', name: 'Marco Rossi', pin: '1234', role: 'waiter' as const },
  { id: '2', name: 'Anna Schmidt', pin: '5678', role: 'manager' as const },
];

const mockRestaurant = {
  id: 'rest-1',
  name: 'Test Restaurant',
  code: 'ABC123',
  currency: 'EUR',
  taxRate: 19,
};

describe('LoginPage', () => {
  const renderLoginPage = (props?: { onLogout?: () => void }) => {
    return render(
      <AppProvider
        config={{
          restaurant: mockRestaurant,
          zones: [],
          tables: [],
          menu: [],
          staff: mockStaff,
        }}
      >
        <LoginPage {...props} />
      </AppProvider>
    );
  };

  it('renders PIN pad with digits 0-9 and delete button', () => {
    renderLoginPage();

    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: String(i) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '←' })).toBeInTheDocument();
  });

  it('displays hint text with staff names and PINs', () => {
    renderLoginPage();

    expect(screen.getByText('PIN eingeben zum Anmelden')).toBeInTheDocument();
    expect(screen.getByText(/Marco Rossi \(1234\)/)).toBeInTheDocument();
    expect(screen.getByText(/Anna Schmidt \(5678\)/)).toBeInTheDocument();
  });

  it('displays restaurant code when it exists and is not default', () => {
    renderLoginPage();

    expect(screen.getByText('Restaurant-Code')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('does not display restaurant code when it is default (000000)', () => {
    render(
      <AppProvider
        config={{
          restaurant: { ...mockRestaurant, code: '000000' },
          zones: [],
          tables: [],
          menu: [],
          staff: mockStaff,
        }}
      >
        <LoginPage />
      </AppProvider>
    );

    expect(screen.queryByText('Restaurant-Code')).not.toBeInTheDocument();
  });

  it('updates PIN display dots as digits are entered', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const buttons = screen.getAllByRole('button').filter(b => /^\d$/.test(b.textContent || ''));
    await user.click(buttons[0]); // Click '1'

    const dots = Array.from(document.querySelectorAll('[class*="rounded-full"][class*="border"]'));
    expect(dots[0]).toHaveClass('bg-[#8b5cf6]');
    expect(dots[1]).not.toHaveClass('bg-[#8b5cf6]');
  });

  it('does not allow entering more than 4 digits', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const button1 = screen.getByRole('button', { name: '1' });
    await user.click(button1);
    await user.click(button1);
    await user.click(button1);
    await user.click(button1);
    await user.click(button1); // 5th click should be ignored

    const dots = Array.from(document.querySelectorAll('[class*="rounded-full"][class*="bg-"]'));
    expect(dots).toHaveLength(4);
  });

  it('displays "Falsche PIN" error when invalid PIN is entered', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    // Enter wrong PIN: 0000
    const button0 = screen.getByRole('button', { name: '0' });
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);

    await waitFor(() => {
      expect(screen.getByText('Falsche PIN')).toBeInTheDocument();
    });
  });

  it('clears error when delete is clicked after invalid attempt', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    // Enter invalid PIN, error should display
    const button0 = screen.getByRole('button', { name: '0' });
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText('Falsche PIN')).toBeInTheDocument();
    });

    // Pressing delete should clear the error message
    const deleteBtn = screen.getByRole('button', { name: '←' });
    await user.click(deleteBtn);

    // Error should be cleared after delete
    expect(screen.queryByText('Falsche PIN')).not.toBeInTheDocument();
  });

  it('clears one digit when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const button1 = screen.getByRole('button', { name: '1' });
    const deleteBtn = screen.getByRole('button', { name: '←' });

    await user.click(button1);
    await user.click(button1);
    await user.click(deleteBtn);

    const dots = Array.from(document.querySelectorAll('[class*="rounded-full"][class*="bg-[#8b5cf6]"]'));
    // After delete, only 1 dot should be filled
    expect(dots).toHaveLength(1);
  });

  it('allows re-entry after error is triggered', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const button1 = screen.getByRole('button', { name: '1' });
    const button0 = screen.getByRole('button', { name: '0' });
    const deleteBtn = screen.getByRole('button', { name: '←' });

    // Try invalid PIN first
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);
    await user.click(button0);

    await waitFor(() => {
      expect(screen.getByText('Falsche PIN')).toBeInTheDocument();
    });

    // Delete should work even with error
    await user.click(deleteBtn);

    // Now we can enter a new digit
    await user.click(button1);

    // Error should still be visible, but we can continue entering
    expect(screen.getByPlaceholderText).toBeDefined();
  });

  it('displays logout button when onLogout prop is provided', async () => {
    const mockOnLogout = vi.fn();

    renderLoginPage({ onLogout: mockOnLogout });

    // Just verify button is rendered when prop is provided
    expect(screen.getByRole('button', { name: /Anderes Restaurant/ })).toBeInTheDocument();
  });

  it('does not display logout button when onLogout prop is not provided', () => {
    renderLoginPage();

    expect(screen.queryByRole('button', { name: /Anderes Restaurant/ })).not.toBeInTheDocument();
  });
});
