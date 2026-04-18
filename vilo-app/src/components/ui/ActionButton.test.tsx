import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconCheck } from '@tabler/icons-react';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  it('renders with children text', () => {
    render(<ActionButton onClick={() => {}}>Click Me</ActionButton>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <ActionButton icon={<IconCheck data-testid="icon" />} onClick={() => {}}>
        Save
      </ActionButton>
    );
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('applies primary variant class by default', () => {
    const { container } = render(<ActionButton onClick={() => {}}>Primary</ActionButton>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-vilo-accent');
    expect(button?.className).toContain('text-white');
  });

  it('applies secondary variant class', () => {
    const { container } = render(
      <ActionButton variant="secondary" onClick={() => {}}>
        Secondary
      </ActionButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-vilo-btn-secondary');
  });

  it('applies danger variant class', () => {
    const { container } = render(
      <ActionButton variant="danger" onClick={() => {}}>
        Delete
      </ActionButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-vilo-btn-danger');
  });

  it('merges custom className with variant classes', () => {
    const { container } = render(
      <ActionButton className="w-auto" onClick={() => {}}>
        Custom
      </ActionButton>
    );
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-vilo-accent');
    expect(button?.className).toContain('w-auto');
  });

  it('fires onClick callback when clicked', async () => {
    const handleClick = vi.fn();
    render(<ActionButton onClick={handleClick}>Click</ActionButton>);
    await userEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('renders with icon and children together', () => {
    const { container } = render(
      <ActionButton icon={<IconCheck data-testid="icon" />} onClick={() => {}}>
        Done
      </ActionButton>
    );
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('applies flex layout classes', () => {
    const { container } = render(<ActionButton onClick={() => {}}>Layout</ActionButton>);
    const button = container.querySelector('button');
    expect(button?.className).toContain('flex');
    expect(button?.className).toContain('items-center');
    expect(button?.className).toContain('justify-center');
  });
});
