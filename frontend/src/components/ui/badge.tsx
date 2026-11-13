import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#EEEBFF] text-[#5147C4] border border-transparent",
        secondary: "bg-secondary text-secondary-foreground border border-transparent",
        destructive: "bg-red-100 text-red-700 border border-transparent",
        outline: "border border-border text-foreground",
        success: "bg-[#E6F8EF] text-emerald-700 border border-transparent",
        warning: "bg-[#FFF1E6] text-orange-700 border border-transparent",
        muted: "bg-muted text-muted-foreground border border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
