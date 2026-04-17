import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceIndicator } from './VoiceIndicator';

const defaultProps = {
  mode: 'idle' as const,
  transcript: '',
  lastCommand: '',
  lastConfirmation: '',
  isSupported: true,
  isWakeMode: false,
  onTapSpeak: vi.fn(),
  onToggleWake: vi.fn(),
  onStop: vi.fn(),
  onUndo: vi.fn(),
};

describe('VoiceIndicator', () => {
  it('should render unsupported message when isSupported is false', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        isSupported={false}
      />
    );
    expect(screen.getByText(/Spracherkennung wird von diesem Browser nicht unterstützt/)).toBeInTheDocument();
  });

  it('should render "Tippe zum Sprechen" in idle mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="idle"
      />
    );
    expect(screen.getByText('Tippe zum Sprechen')).toBeInTheDocument();
  });

  it('should render "Sage "Hey Vilo"..." in listening_wake mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_wake"
      />
    );
    expect(screen.getByText(/Sage "Hey Vilo"/)).toBeInTheDocument();
  });

  it('should render "Ich höre zu..." in listening_command mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_command"
      />
    );
    expect(screen.getByText('Ich höre zu...')).toBeInTheDocument();
  });

  it('should render "Verarbeite..." in processing mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="processing"
      />
    );
    expect(screen.getByText('Verarbeite...')).toBeInTheDocument();
  });

  it('should display transcript when in non-idle mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_command"
        transcript="Reservierung für vier Personen"
      />
    );
    expect(screen.getByText(/Reservierung für vier Personen/)).toBeInTheDocument();
  });

  it('should not display transcript in idle mode', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        mode="idle"
        transcript="Some transcript"
      />
    );
    // Transcript should not be rendered if mode is idle
    const textElements = screen.queryAllByText(/Some transcript/);
    expect(textElements).toHaveLength(0);
  });

  it('should display last command when provided', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        lastCommand="Tisch 5 öffnen"
      />
    );
    expect(screen.getByText(/Erkannt:/)).toBeInTheDocument();
    expect(screen.getByText(/Tisch 5 öffnen/)).toBeInTheDocument();
  });

  it('should display last confirmation when provided', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        lastConfirmation="Tisch 5 erfolgreich geöffnet"
      />
    );
    expect(screen.getByText(/Tisch 5 erfolgreich geöffnet/)).toBeInTheDocument();
  });

  it('should show both command and confirmation when both are provided', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        lastCommand="Tisch 5 öffnen"
        lastConfirmation="Erfolgreich!"
      />
    );
    expect(screen.getByText(/Erkannt:/)).toBeInTheDocument();
    expect(screen.getByText(/Tisch 5 öffnen/)).toBeInTheDocument();
    expect(screen.getByText(/Erfolgreich!/)).toBeInTheDocument();
  });

  it('should call onTapSpeak when mic button is clicked in idle mode', async () => {
    const user = userEvent.setup();
    const onTapSpeak = vi.fn();
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="idle"
        onTapSpeak={onTapSpeak}
      />
    );

    const micButton = container.querySelector('button');
    await user.click(micButton!);
    expect(onTapSpeak).toHaveBeenCalled();
  });

  it('should call onTapSpeak when mic button is clicked in listening_wake mode', async () => {
    const user = userEvent.setup();
    const onTapSpeak = vi.fn();
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_wake"
        onTapSpeak={onTapSpeak}
      />
    );

    const buttons = container.querySelectorAll('button');
    const micButton = buttons[0]; // First button is the mic
    await user.click(micButton);
    expect(onTapSpeak).toHaveBeenCalled();
  });

  it('should call onStop when mic button is clicked in listening_command mode', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_command"
        onStop={onStop}
      />
    );

    const buttons = container.querySelectorAll('button');
    const micButton = buttons[0]; // First button is the mic
    await user.click(micButton);
    expect(onStop).toHaveBeenCalled();
  });

  it('should call onUndo when undo button is clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <VoiceIndicator
        {...defaultProps}
        lastCommand="Tisch öffnen"
        onUndo={onUndo}
      />
    );

    const undoButton = screen.getByTitle('Rückgängig');
    await user.click(undoButton);
    expect(onUndo).toHaveBeenCalled();
  });

  it('should toggle wake mode when wake mode button is clicked in non-wake state', async () => {
    const user = userEvent.setup();
    const onToggleWake = vi.fn();
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        isWakeMode={false}
        onToggleWake={onToggleWake}
      />
    );

    const buttons = container.querySelectorAll('button');
    const wakeButton = buttons[1]; // Second button is the wake toggle
    await user.click(wakeButton);
    expect(onToggleWake).toHaveBeenCalled();
  });

  it('should call onStop when wake mode button is clicked in wake state', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        isWakeMode={true}
        onStop={onStop}
      />
    );

    const buttons = container.querySelectorAll('button');
    const wakeButton = buttons[1]; // Second button is the wake toggle
    await user.click(wakeButton);
    expect(onStop).toHaveBeenCalled();
  });

  it('should have correct wake mode button title when wake mode is active', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        isWakeMode={true}
      />
    );
    const wakeButton = screen.getByTitle('Hey Vilo Modus aus');
    expect(wakeButton).toBeInTheDocument();
  });

  it('should have correct wake mode button title when wake mode is inactive', () => {
    render(
      <VoiceIndicator
        {...defaultProps}
        isWakeMode={false}
      />
    );
    const wakeButton = screen.getByTitle('Hey Vilo Modus an');
    expect(wakeButton).toBeInTheDocument();
  });

  it('should render with dark purple background color in idle mode', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="idle"
      />
    );
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('bg-[#251a3d]');
  });

  it('should render with purple background color in listening_wake mode', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_wake"
      />
    );
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('bg-[#5b21b6]');
  });

  it('should render with bright purple background color in listening_command mode', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="listening_command"
      />
    );
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('bg-[#742fe6]');
  });

  it('should render with amber background color in processing mode', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        mode="processing"
      />
    );
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('bg-amber-900/80');
  });

  it('should not render last command/confirmation section when both are empty', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        lastCommand=""
        lastConfirmation=""
      />
    );
    // Check that the command/confirmation section is not rendered
    const sections = container.querySelectorAll('.px-4.py-2');
    expect(sections).toHaveLength(0);
  });

  it('should render command/confirmation section when lastCommand is provided', () => {
    const { container } = render(
      <VoiceIndicator
        {...defaultProps}
        lastCommand="Test command"
        lastConfirmation=""
      />
    );
    const commandSection = container.querySelector('.px-4.py-2');
    expect(commandSection).toBeInTheDocument();
  });
});
