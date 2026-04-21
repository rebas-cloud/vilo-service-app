interface BrandWordmarkProps {
  className?: string;
}

export function BrandWordmark({ className = '' }: BrandWordmarkProps) {
  return (
    <span
      className={`inline-block whitespace-nowrap leading-none text-white font-bold tracking-wide ${className}`.trim()}
      aria-label="vilo"
      style={{
        fontFamily: "'Otista', 'Sen', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}
    >
      vilo
    </span>
  );
}
