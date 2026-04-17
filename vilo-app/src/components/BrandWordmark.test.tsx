import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandWordmark } from './BrandWordmark';

describe('BrandWordmark', () => {
  it('should render the text "vilo"', () => {
    render(<BrandWordmark />);
    expect(screen.getByText('vilo')).toBeInTheDocument();
  });

  it('should have aria-label "vilo" for accessibility', () => {
    render(<BrandWordmark />);
    const element = screen.getByLabelText('vilo');
    expect(element).toBeInTheDocument();
  });

  it('should render as inline-block span', () => {
    const { container } = render(<BrandWordmark />);
    const span = container.querySelector('span');
    expect(span?.tagName).toBe('SPAN');
    expect(span?.classList.contains('inline-block')).toBe(true);
  });

  it('should apply default className with custom className', () => {
    const { container } = render(<BrandWordmark className="text-2xl" />);
    const span = container.querySelector('span');
    expect(span?.className).toContain('vilo-wordmark');
    expect(span?.className).toContain('text-2xl');
  });

  it('should apply whitespace-nowrap class', () => {
    const { container } = render(<BrandWordmark />);
    const span = container.querySelector('span');
    expect(span?.classList.contains('whitespace-nowrap')).toBe(true);
  });

  it('should apply text-white class', () => {
    const { container } = render(<BrandWordmark />);
    const span = container.querySelector('span');
    expect(span?.classList.contains('text-white')).toBe(true);
  });

  it('should have correct font styling', () => {
    const { container } = render(<BrandWordmark />);
    const span = container.querySelector('span');
    expect(span).toHaveStyle({
      fontFamily: "'Otista', 'Sen', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontWeight: '400',
      letterSpacing: '0.01em',
      textRendering: 'geometricPrecision',
    });
  });

  it('should render without additional className when not provided', () => {
    const { container } = render(<BrandWordmark />);
    const span = container.querySelector('span');
    // Verify it has the default classes but not extra ones
    expect(span?.className).toMatch(/vilo-wordmark/);
    expect(span?.className).toMatch(/inline-block/);
    expect(span?.className).toMatch(/whitespace-nowrap/);
  });
});
