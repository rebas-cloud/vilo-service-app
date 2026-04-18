import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurfaceCard } from './SurfaceCard';

describe('SurfaceCard', () => {
  it('renders with children', () => {
    render(<SurfaceCard>Content inside card</SurfaceCard>);
    expect(screen.getByText('Content inside card')).toBeInTheDocument();
  });

  it('renders as div by default', () => {
    const { container } = render(<SurfaceCard>Card</SurfaceCard>);
    const element = container.firstChild;
    expect((element as HTMLElement).tagName).toBe('DIV');
  });

  it('renders as button when as="button" is set', () => {
    const { container } = render(<SurfaceCard as="button">Button Card</SurfaceCard>);
    const element = container.firstChild;
    expect((element as HTMLElement).tagName).toBe('BUTTON');
  });

  it('applies default variant class', () => {
    const { container } = render(<SurfaceCard>Default</SurfaceCard>);
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('bg-vilo-card');
  });

  it('applies alt variant class', () => {
    const { container } = render(<SurfaceCard variant="alt">Alternative</SurfaceCard>);
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('bg-vilo-card-alt');
  });

  it('does not apply button-specific classes for div', () => {
    const { container } = render(<SurfaceCard as="div">Div Card</SurfaceCard>);
    const element = container.firstChild as HTMLElement;
    expect(element.className).not.toContain('hover:brightness-110');
    expect(element.className).not.toContain('cursor-pointer');
  });

  it('applies button-specific classes when as="button"', () => {
    const { container } = render(<SurfaceCard as="button">Button Card</SurfaceCard>);
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('hover:brightness-110');
    expect(element.className).toContain('transition-all');
    expect(element.className).toContain('cursor-pointer');
  });

  it('merges custom className with variant classes', () => {
    const { container } = render(
      <SurfaceCard className="p-6">
        Custom
      </SurfaceCard>
    );
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('bg-vilo-card');
    expect(element.className).toContain('p-6');
  });

  it('supports native div attributes', () => {
    const { container } = render(
      <SurfaceCard data-testid="test-card" id="card-1">
        Card
      </SurfaceCard>
    );
    const element = container.querySelector('[data-testid="test-card"]');
    expect(element?.id).toBe('card-1');
  });

  it('combines alt variant with custom className and button tag', () => {
    const { container } = render(
      <SurfaceCard variant="alt" as="button" className="max-w-sm">
        Complex Card
      </SurfaceCard>
    );
    const element = container.firstChild as HTMLElement;
    expect((element as HTMLElement).tagName).toBe('BUTTON');
    expect(element.className).toContain('bg-vilo-card-alt');
    expect(element.className).toContain('max-w-sm');
    expect(element.className).toContain('hover:brightness-110');
  });
});
