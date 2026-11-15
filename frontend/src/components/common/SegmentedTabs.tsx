import type { ComponentType } from "react";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** A small counter, e.g. how many wait for review. */
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** One tab style for the whole cabinet. Scrolls sideways on a narrow phone. */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className = "",
}: SegmentedTabsProps<T>) {
  return (
    <div className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div role="tablist" className="inline-flex gap-1 rounded-2xl bg-muted p-1">
        {items.map(({ value: v, label, icon: Icon, count }) => {
          const active = v === value;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition-colors ${
                active
                  ? "bg-card font-semibold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {label}
              {!!count && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
