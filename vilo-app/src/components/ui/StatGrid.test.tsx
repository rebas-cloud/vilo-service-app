import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatGrid } from './StatGrid';

describe('StatGrid', () => {
  it('renders grid of stat items', () => {
    const items = [
      { label: 'Orders', value: '42' },
      { label: 'Revenue', value: '€1,200' },
      { label: 'Guests', value: '156' },
    ];
    render(<StatGrid items={items} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('€1,200')).toBeInTheDocument();
    expect(screen.getByText('156')).toBeInTheDocument();
  });

  it('renders labels for each item', () => {
    const items = [
      { label: 'Orders', value: '42' },
      { label: 'Revenue', value: '€1,200' },
    ];
    render(<StatGrid items={items} />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders values without labels', () => {
    const items = [{ value: '100' }, { value: '200' }];
    render(<StatGrid items={items} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('applies default 3-column layout', () => {
    const { container } = render(
      <StatGrid items={[{ value: '1' }, { value: '2' }, { value: '3' }]} />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid-cols-3');
  });

  it('applies 2-column layout when cols={2}', () => {
    const { container } = render(
      <StatGrid cols={2} items={[{ value: '1' }, { value: '2' }]} />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid-cols-2');
  });

  it('applies 4-column layout when cols={4}', () => {
    const { container } = render(
      <StatGrid cols={4} items={[{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }]} />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid-cols-4');
  });

  it('renders background color on stat cells', () => {
    const { container } = render(
      <StatGrid items={[{ label: 'Test', value: '123' }]} />
    );
    const cell = container.querySelector('.bg-vilo-card');
    expect(cell).toBeInTheDocument();
  });

  it('applies custom gap class', () => {
    const { container } = render(
      <StatGrid gap={4} items={[{ value: '1' }]} />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('gap-4');
  });

  it('applies default gap-2 when not specified', () => {
    const { container } = render(
      <StatGrid items={[{ value: '1' }]} />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('gap-2');
  });

  it('merges custom className with grid classes', () => {
    const { container } = render(
      <StatGrid items={[{ value: '1' }]} className="mt-6" />
    );
    const grid = container.firstChild;
    expect((grid as HTMLElement).className).toContain('grid');
    expect((grid as HTMLElement).className).toContain('mt-6');
  });

  it('applies custom value className to stat cells', () => {
    const items = [
      { label: 'Highlight', value: '99', valueClassName: 'text-red-500' },
    ];
    render(<StatGrid items={items} />);
    const value = screen.getByText('99');
    expect(value.className).toContain('text-red-500');
  });

  it('renders many items in grid', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      label: `Stat ${i + 1}`,
      value: String(i + 1),
    }));
    const { container } = render(<StatGrid cols={4} items={items} gap={3} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-vilo-card').length).toBe(12);
  });

  it('renders react nodes as values', () => {
    const items = [
      { label: 'Complex', value: <span data-testid="react-node">React Node</span> },
    ];
    render(<StatGrid items={items} />);
    expect(screen.getByTestId('react-node')).toBeInTheDocument();
  });

  it('applies padding and text-center styling to cells', () => {
    const { container } = render(
      <StatGrid items={[{ label: 'Test', value: '50' }]} />
    );
    const cell = container.querySelector('.bg-vilo-card');
    expect(cell?.className).toContain('px-3');
    expect(cell?.className).toContain('py-2.5');
    expect(cell?.className).toContain('text-center');
  });
});
