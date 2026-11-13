import { Leaf } from "lucide-react";

interface LogoProps {
  size?: "sm" | "lg";
  showName?: boolean;
}

export function Logo({ size = "sm", showName = true }: LogoProps) {
  const mark = (
    <div
      className={`${
        size === "lg" ? "h-14 w-14 rounded-2xl" : "h-8 w-8 rounded-xl"
      } bg-[#6D5DF6] flex items-center justify-center shadow-sm`}
    >
      <Leaf className={`${size === "lg" ? "h-9 w-9" : "h-5 w-5"} text-white`} />
    </div>
  );

  if (!showName) return mark;

  return (
    <div className="flex items-center gap-2.5">
      {mark}
      <span className="text-base font-bold tracking-tight text-foreground">mindleaf</span>
    </div>
  );
}
