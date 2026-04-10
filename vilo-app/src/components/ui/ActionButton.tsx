import { cn } from '../../lib/utils';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

const variants = {
  primary: 'bg-vilo-accent hover:bg-vilo-accent-hover text-white',
  secondary: 'bg-vilo-btn-secondary text-vilo-text-danger',
  danger: 'bg-vilo-btn-danger text-vilo-text-danger',
};

export function ActionButton({ variant = 'primary', icon, className, children, ...props }: ActionButtonProps) {
  return (
    <button
      className={cn(
        'w-full flex items-center justify-center gap-3 py-3 px-4 font-semibold text-[15px] transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
