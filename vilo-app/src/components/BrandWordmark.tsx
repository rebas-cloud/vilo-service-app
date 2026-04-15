interface BrandWordmarkProps {
  className?: string;
}

export function BrandWordmark({ className = '' }: BrandWordmarkProps) {
  return (
    <span
      className={`vilo-wordmark inline-block whitespace-nowrap leading-none text-white ${className}`.trim()}
      aria-label="vilo"
      style={{
        fontFamily: "'Otista', 'Sen', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontWeight: 400,
        letterSpacing: '0.01em',
        textRendering: 'geometricPrecision',
      }}
    >
      vilo
    </span>
  );
}
