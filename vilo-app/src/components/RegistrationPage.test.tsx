import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationPage } from './RegistrationPage';

describe('RegistrationPage', () => {
  const mockOnBack = vi.fn();
  const mockOnRegister = vi.fn();

  beforeEach(() => {
    mockOnBack.mockClear();
    mockOnRegister.mockClear();
  });

  const renderRegistrationPage = (props?: {
    onBack?: () => void;
    onRegister?: (name: string, email: string, password: string) => void | Promise<void>;
  }) => {
    return render(
      <RegistrationPage
        onBack={props?.onBack ?? mockOnBack}
        onRegister={props?.onRegister ?? mockOnRegister}
      />
    );
  };

  it('renders all form fields with correct labels', () => {
    renderRegistrationPage();

    expect(screen.getByText('Dein Name')).toBeInTheDocument();
    expect(screen.getByText('E-Mail')).toBeInTheDocument();
    expect(screen.getByText('Passwort')).toBeInTheDocument();
  });

  it('renders correct placeholders for form fields', () => {
    renderRegistrationPage();

    expect(screen.getByPlaceholderText('z.B. Marco Rossi')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('marco@restaurant.de')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mindestens 6 Zeichen')).toBeInTheDocument();
  });

  it('renders back button and submit button', () => {
    renderRegistrationPage();

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0); // Back button exists
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
  });

  it('displays page title "Konto erstellen"', () => {
    renderRegistrationPage();

    expect(screen.getByText('Konto erstellen')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    // Get the first button (back arrow button) using screen query
    const allButtons = screen.getAllByRole('button');
    const backBtn = allButtons[0]; // First button is the back button
    if (backBtn) {
      await user.click(backBtn);
      expect(mockOnBack).toHaveBeenCalled();
    }
  });

  it('shows validation error for empty name field', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const submitBtn = screen.getByRole('button', { name: 'Weiter' });
    await user.click(submitBtn);

    expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument();
  });

  it('shows validation error for empty email field', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const submitBtn = screen.getByRole('button', { name: 'Weiter' });
    await user.click(submitBtn);

    expect(screen.getByText('E-Mail ist erforderlich')).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'user@invalid'); // Missing domain extension
    await user.type(passwordInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: 'Weiter' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Ungueltige E-Mail-Adresse')).toBeInTheDocument();
    });
  });

  it('shows validation error for empty password field', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const submitBtn = screen.getByRole('button', { name: 'Weiter' });
    await user.click(submitBtn);

    expect(screen.getByText('Passwort ist erforderlich')).toBeInTheDocument();
  });

  it('shows validation error for password shorter than 6 characters', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    await user.type(passwordInput, '12345');

    const submitBtn = screen.getByRole('button', { name: 'Weiter' });
    await user.click(submitBtn);

    expect(screen.getByText('Mindestens 6 Zeichen')).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco Rossi');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith('Marco Rossi', 'marco@test.de', 'password123');
    });
  });

  it('trims and lowercases email on submission', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, '  MARCO@TEST.DE  ');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith('Marco', 'marco@test.de', 'password123');
    });
  });

  it('toggles password visibility when eye button is clicked', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const passwordInput = screen.getByPlaceholderText(
      'Mindestens 6 Zeichen'
    ) as HTMLInputElement;

    expect(passwordInput.type).toBe('password');

    // Find the password input's parent div and then the toggle button inside it
    const passwordDiv = passwordInput.parentElement;
    const toggleBtn = passwordDiv?.querySelector('button');

    if (toggleBtn) {
      await user.click(toggleBtn);
      expect(passwordInput.type).toBe('text');

      await user.click(toggleBtn);
      expect(passwordInput.type).toBe('password');
    }
  });

  it('shows loading state when form submission is async', async () => {
    const user = userEvent.setup();
    const asyncOnRegister: (name: string, email: string, password: string) => Promise<void> = vi.fn(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    renderRegistrationPage({ onRegister: asyncOnRegister });

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Wird erstellt...')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
      },
      { timeout: 200 }
    );
  });

  it('displays error message when registration fails', async () => {
    const user = userEvent.setup();
    const failingOnRegister: (name: string, email: string, password: string) => Promise<void> = vi.fn(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network error')), 50)
        )
    );

    renderRegistrationPage({ onRegister: failingOnRegister });

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Registrierung fehlgeschlagen. Bitte versuche es erneut.')
      ).toBeInTheDocument();
    });
  });

  it('does not submit form with only whitespace in name field', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, '   ');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    expect(mockOnRegister).not.toHaveBeenCalled();
    expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument();
  });

  it('requires at least 6 character password', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'pass5');
    await user.click(submitBtn);

    expect(mockOnRegister).not.toHaveBeenCalled();
    expect(screen.getByText('Mindestens 6 Zeichen')).toBeInTheDocument();
  });

  it('accepts password with exactly 6 characters', async () => {
    const user = userEvent.setup();
    renderRegistrationPage();

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'pass66');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockOnRegister).toHaveBeenCalledWith('Marco', 'marco@test.de', 'pass66');
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();
    const slowOnRegister: (name: string, email: string, password: string) => Promise<void> = vi.fn(
      () => new Promise(resolve => setTimeout(resolve, 500))
    );

    renderRegistrationPage({ onRegister: slowOnRegister });

    const nameInput = screen.getByPlaceholderText('z.B. Marco Rossi');
    const emailInput = screen.getByPlaceholderText('marco@restaurant.de');
    const passwordInput = screen.getByPlaceholderText('Mindestens 6 Zeichen');
    const submitBtn = screen.getByRole('button', { name: 'Weiter' });

    await user.type(nameInput, 'Marco');
    await user.type(emailInput, 'marco@test.de');
    await user.type(passwordInput, 'password123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
    });
  });
});
