import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

interface InfoRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  chevron?: boolean;
}

export function InfoRow({ icon, title, subtitle, badge, right, chevron, className, ...props }: InfoRowProps) {
  return (
    <div className={cn('flex items-center gap-3', className)} {...props}>
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center text-vilo-text-dim">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-white">{title}</div>
        {subtitle && <div className="mt-0.5 text-[11px] text-vilo-text-muted">{subtitle}</div>}
        {badge && <div className="mt-1 inline-flex bg-[#4b3a83] px-2 py-1 text-[11px] font-medium text-[#d9c4ff]">{badge}</div>}
      </div>
      {right}
      {chevron && <IconChevronRight className="h-4 w-4 shrink-0 text-[#a9a4ca]" />}
    </div>
  );
}
