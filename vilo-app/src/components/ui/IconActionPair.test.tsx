import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconCheck, IconX } from '@tabler/icons-react';
import { IconActionPair } from './IconActionPair';

describe('IconActionPair', () => {
  it('renders icons from actions array', () => {
    const actions = [
      { icon: <IconCheck data-testid="icon-1" />, onClick: () => {} },
      { icon: <IconX data-testid="icon-2" />, onClick: () => {} },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    expect(container.querySelector('[data-testid="icon-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="icon-2"]')).toBeInTheDocument();
  });

  it('renders buttons for each action', () => {
    const actions = [
      { icon: <IconCheck />, onClick: () => {} },
      { icon: <IconX />, onClick: () => {} },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('calls onClick callback when button is clicked', async () => {
    const handleClick = vi.fn();
    const actions = [
      { icon: <IconCheck data-testid="icon" />, onClick: handleClick },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    await userEvent.click(button!);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('calls correct onClick for each action', async () => {
    const handle1 = vi.fn();
    const handle2 = vi.fn();
    const actions = [
      { icon: <IconCheck data-testid="icon-1" />, onClick: handle1 },
      { icon: <IconX data-testid="icon-2" />, onClick: handle2 },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const buttons = container.querySelectorAll('button');
    await userEvent.click(buttons[0]);
    await userEvent.click(buttons[1]);
    expect(handle1).toHaveBeenCalledOnce();
    expect(handle2).toHaveBeenCalledOnce();
  });

  it('applies aria-label from action label prop', () => {
    const actions = [
      { icon: <IconCheck />, label: 'Confirm', onClick: () => {} },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Confirm');
  });

  it('applies vilo-interactive background color', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('bg-vilo-interactive');
  });

  it('applies vilo-interactive-hover on hover', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('hover:bg-vilo-interactive-hover');
  });

  it('applies vilo-text-dim color to icon', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('text-vilo-text-dim');
  });

  it('applies grid layout with 2 columns', () => {
    const actions = [
      { icon: <IconCheck />, onClick: () => {} },
      { icon: <IconX />, onClick: () => {} },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid');
    expect((grid as HTMLElement).className).toContain('grid-cols-2');
  });

  it('applies gap-2 between buttons', () => {
    const actions = [
      { icon: <IconCheck />, onClick: () => {} },
      { icon: <IconX />, onClick: () => {} },
    ];
    const { container } = render(<IconActionPair actions={actions} />);
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('gap-2');
  });

  it('applies min-h-[68px] to buttons', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('min-h-[68px]');
  });

  it('centers icon content', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(<IconActionPair actions={actions} />);
    const button = container.querySelector('button');
    expect(button?.className).toContain('flex');
    expect(button?.className).toContain('items-center');
    expect(button?.className).toContain('justify-center');
  });

  it('merges custom className with grid classes', () => {
    const actions = [{ icon: <IconCheck />, onClick: () => {} }];
    const { container } = render(
      <IconActionPair actions={actions} className="custom-class" />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid');
    expect((grid as HTMLElement).className).toContain('custom-class');
  });

  it('handles empty actions array', () => {
    const { container } = render(<IconActionPair actions={[]} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('handles action without onClick', () => {
    const actions = [{ icon: <IconCheck data-testid="icon" /> }];
    const { container } = render(<IconActionPair actions={actions} />);
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });
});
