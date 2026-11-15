/** MindLeaf brand: a sprout with two leaves and the "MindLeaf" wordmark. */

const INK = "#2A1A4E";
const LEAF_DARK = "#5B3DB5";
const LEAF_LIGHT = "#7650DC";

interface SproutProps {
  className?: string;
  /** "color" — on a light background; "white" — inside the purple app icon. */
  tone?: "color" | "white";
  /** The ground line under the stem (the full logo has it, small icons do not). */
  ground?: boolean;
}

/** The sprout alone. Small places (favicon-size) use it without the ground line. */
export function SproutMark({ className = "h-6 w-6", tone = "color", ground = false }: SproutProps) {
  const white = tone === "white";
  const stem = white ? "#FFFFFF" : INK;
  const left = white ? "#D9CCFA" : LEAF_DARK;
  const right = white ? "#FFFFFF" : LEAF_LIGHT;
  const vein = white ? LEAF_LIGHT : "#FFFFFF";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M31 33 C21 35 8 29 5 16 C17 13 29 20 31 33 Z" fill={left} />
      <path d="M33 31 C33 18 45 7 60 5 C59 20 47 31 33 31 Z" fill={right} />
      {!white && (
        <g stroke={vein} strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
          <line x1="26" y1="28" x2="12" y2="19" />
          <line x1="38" y1="25" x2="53" y2="12" />
        </g>
      )}
      <line
        x1="32"
        y1="30"
        x2="32"
        y2={ground ? 56 : 60}
        stroke={stem}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {ground && (
        <line x1="17" y1="57" x2="47" y2="57" stroke={stem} strokeWidth="4" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** The rounded purple app icon with a white sprout (avatars, login, favicon). */
export function AppIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[28%] bg-gradient-to-br from-[#7B57E4] to-[#6340CC] shadow-sm ${className}`}
    >
      <SproutMark tone="white" className="h-[62%] w-[62%]" />
    </span>
  );
}

interface LogoProps {
  size?: "sm" | "lg";
  /** "Репетитор · учні · батьки" under the name (login page). */
  tagline?: boolean;
}

/** The full logo: sprout with ground line + "MindLeaf". Top-left of the cabinet. */
export function Logo({ size = "sm", tagline = false }: LogoProps) {
  const lg = size === "lg";
  return (
    <div className={`flex items-center ${lg ? "gap-4" : "gap-2"}`} aria-label="MindLeaf">
      <SproutMark ground className={lg ? "h-16 w-16" : "h-9 w-9"} />
      <div className="leading-none">
        <span
          className={`block font-extrabold tracking-tight ${lg ? "text-4xl" : "text-[22px]"}`}
          style={{ fontFamily: '"Nunito", "Manrope", system-ui, sans-serif' }}
        >
          <span style={{ color: INK }}>Mind</span>
          <span style={{ color: LEAF_LIGHT }}>Leaf</span>
        </span>
        {tagline && (
          <span className="mt-2 block text-sm font-semibold text-[#5A4A7E]">
            Репетитор · учні · батьки
          </span>
        )}
      </div>
    </div>
  );
}
