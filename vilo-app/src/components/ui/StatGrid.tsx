import { cn } from '../../lib/utils';

interface StatCellData {
  value: React.ReactNode;
  label?: string;
  valueClassName?: string;
}

interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
  items: StatCellData[];
  gap?: number;
}

const colsMap = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export function StatGrid({ cols = 3, items, gap = 2, className, ...props }: StatGridProps) {
  return (
    <div className={cn('grid', colsMap[cols], `gap-${gap}`, className)} {...props}>
      {items.map((item, i) => (
        <div key={i} className="bg-vilo-card px-3 py-2.5 text-center">
          <div className={cn('text-[12px] font-bold text-white', item.valueClassName)}>{item.value}</div>
          {item.label && <div className="text-vilo-text-muted text-[9px] uppercase tracking-[0.14em] mt-1">{item.label}</div>}
        </div>
      ))}
    </div>
  );
}
