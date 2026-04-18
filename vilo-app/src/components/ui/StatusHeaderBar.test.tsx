import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconClock } from '@tabler/icons-react';
import { StatusHeaderBar } from './StatusHeaderBar';

describe('StatusHeaderBar', () => {
  it('renders label text', () => {
    render(<StatusHeaderBar label="Active" color="#ff0000" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <StatusHeaderBar label="Status" icon={<IconClock data-testid="icon" />} color="#ff0000" />
    );
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('applies color as gradient background', () => {
    const { container } = render(<StatusHeaderBar label="Test" color="#ff0000" />);
    const button = container.querySelector('button');
    const style = button?.getAttribute('style');
    expect(style).toContain('linear-gradient');
    expect(style).toContain('#ff0000');
  });

  it('applies vilo-accent and vilo-accent-hover to gradient', () => {
    const { container } = render(<StatusHeaderBar label="Test" color="#ff0000" />);
    const button = container.querySelector('button');
    const style = button?.getAttribute('style');
    expect(style).toContain('var(--vilo-accent)');
    expect(style).toContain('var(--vilo-accent-hover)');
  });

  it('renders chevron icon', () => {
    const { container } = render(<StatusHeaderBar label="Test" color="#ff0000" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('rotates chevron when open is true', () => {
    const { container } = render(
      <StatusHeaderBar label="Test" color="#ff0000" open={true} />
    );
    const chevron = container.querySelector('svg');
    expect(chevron?.className.baseVal || chevron?.className).toContain('rotate-180');
  });

  it('does not rotate chevron when open is false', () => {
    const { container } = render(
      <StatusHeaderBar label="Test" color="#ff0000" open={false} />
    );
    const chevron = container.querySelector('svg');
    const classAttr = chevron?.className.baseVal || chevron?.className || '';
    expect(classAttr).not.toContain('rotate-180');
  });

  it('calls onToggle callback when clicked', async () => {
    const handleToggle = vi.fn();
    render(<StatusHeaderBar label="Test" color="#ff0000" onToggle={handleToggle} />);
    await userEvent.click(screen.getByText('Test'));
    expect(handleToggle).toHaveBeenCalledOnce();
  });

  it('renders button with white text styling', () => {
    const { container } = render(<StatusHeaderBar label="Test" color="#ff0000" />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('text-white');
    expect(button?.className).toContain('font-semibold');
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatusHeaderBar label="Test" color="#ff0000" className="mt-4" />
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('mt-4');
  });

  it('renders full width button', () => {
    const { container } = render(<StatusHeaderBar label="Test" color="#ff0000" />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('w-full');
  });

  it('handles different color values', () => {
    const { container: container1 } = render(
      <StatusHeaderBar label="Green" color="#00ff00" />
    );
    const { container: container2 } = render(
      <StatusHeaderBar label="Blue" color="rgb(0, 0, 255)" />
    );
    const button1 = container1.querySelector('button');
    const button2 = container2.querySelector('button');
    expect(button1?.getAttribute('style')).toContain('#00ff00');
    expect(button2?.getAttribute('style')).toContain('rgb(0, 0, 255)');
  });
});
