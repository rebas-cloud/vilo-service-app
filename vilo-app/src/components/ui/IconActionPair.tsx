import { cn } from '../../lib/utils';

interface IconAction {
  icon: React.ReactNode;
  onClick?: () => void;
  label?: string;
}

interface IconActionPairProps extends React.HTMLAttributes<HTMLDivElement> {
  actions: IconAction[];
}

export function IconActionPair({ actions, className, ...props }: IconActionPairProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)} {...props}>
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          aria-label={action.label}
          className="flex min-h-[68px] items-center justify-center bg-vilo-interactive text-vilo-text-dim hover:bg-vilo-interactive-hover transition-colors"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
