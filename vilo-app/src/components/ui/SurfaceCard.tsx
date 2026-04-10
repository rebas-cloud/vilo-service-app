import { cn } from '../../lib/utils';

interface SurfaceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'alt';
  as?: 'div' | 'button';
}

export function SurfaceCard({ variant = 'default', as = 'div', className, children, ...props }: SurfaceCardProps) {
  const Tag = as as 'div';
  return (
    <Tag
      className={cn(
        variant === 'alt' ? 'bg-vilo-card-alt' : 'bg-vilo-card',
        as === 'button' && 'hover:brightness-110 transition-all cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
