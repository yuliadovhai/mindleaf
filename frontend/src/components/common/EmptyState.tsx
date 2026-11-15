import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  text: string;
  /** Usually the button that fixes the emptiness ("Додати учня"). */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
        <Icon className="h-6 w-6 text-primary/60" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
