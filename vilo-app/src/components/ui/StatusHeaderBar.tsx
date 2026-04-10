import { IconChevronDown } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

interface StatusHeaderBarProps {
  icon?: React.ReactNode;
  label: string;
  color: string;
  onToggle?: () => void;
  open?: boolean;
  className?: string;
}

export function StatusHeaderBar({ icon, label, color, onToggle, open, className }: StatusHeaderBarProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn('w-full px-4 py-3 flex items-center justify-between text-white font-semibold text-[13px]', className)}
      style={{ background: `linear-gradient(90deg, ${color} 0%, var(--vilo-accent) 55%, var(--vilo-accent-hover) 100%)` }}
    >
      <div className="flex items-center gap-2">
        {icon}
        {label}
      </div>
      <IconChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
    </button>
  );
}
