import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconUser } from '@tabler/icons-react';
import { InfoRow } from './InfoRow';

describe('InfoRow', () => {
  it('renders title', () => {
    render(<InfoRow title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <InfoRow title="Title" icon={<IconUser data-testid="test-icon" />} />
    );
    expect(container.querySelector('[data-testid="test-icon"]')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<InfoRow title="Title" subtitle="Subtitle text" />);
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    render(<InfoRow title="Title" />);
    const subtitleElement = document.body.querySelector('[class*="text-vilo-text-muted"]');
    expect(subtitleElement).not.toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<InfoRow title="Title" badge="VIP" />);
    expect(screen.getByText('VIP')).toBeInTheDocument();
  });

  it('renders right content when provided', () => {
    render(<InfoRow title="Title" right={<span data-testid="right-content">Right</span>} />);
    expect(screen.getByTestId('right-content')).toBeInTheDocument();
  });

  it('renders chevron icon when chevron prop is true', () => {
    const { container } = render(<InfoRow title="Title" chevron />);
    // IconChevronRight is rendered
    const chevron = container.querySelector('svg');
    expect(chevron).toBeInTheDocument();
  });

  it('does not render chevron when chevron prop is false', () => {
    const { container } = render(<InfoRow title="Title" chevron={false} />);
    // No chevron should be present (only title SVG if icon exists)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('applies icon container styling', () => {
    const { container } = render(
      <InfoRow title="Title" icon={<IconUser data-testid="test-icon" />} />
    );
    const iconContainer = container.querySelector('.h-10');
    expect(iconContainer).toBeInTheDocument();
    expect(iconContainer?.className).toContain('w-10');
    expect(iconContainer?.className).toContain('text-vilo-text-dim');
  });

  it('applies truncate class to title', () => {
    render(<InfoRow title="Very Long Title Text" />);
    const titleElement = screen.getByText('Very Long Title Text');
    expect(titleElement.className).toContain('truncate');
  });

  it('merges custom className', () => {
    const { container } = render(
      <InfoRow title="Title" className="custom-class" />
    );
    const rootElement = container.firstChild;
    expect((rootElement as HTMLElement).className).toContain('custom-class');
    expect((rootElement as HTMLElement).className).toContain('flex');
  });

  it('renders complete row with all props', () => {
    render(
      <InfoRow
        title="John Doe"
        subtitle="Premium Guest"
        icon={<IconUser data-testid="icon" />}
        badge="VIP"
        right={<span>→</span>}
        chevron
      />
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Premium Guest')).toBeInTheDocument();
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
  });
});
