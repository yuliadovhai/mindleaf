const fmt = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Копійки → "1 234,50 ₴" */
export function formatMoney(kopecks: number): string {
  return fmt.format(kopecks / 100);
}

/** Гривні (рядок від користувача) → копійки без float-помилок.
 *  "150" → 15000, "150.50" → 15050, "150,50" → 15050. */
export function parseMoney(input: string): number {
  const normalized = input.trim().replace(",", ".");
  const float = parseFloat(normalized);
  if (isNaN(float)) return 0;
  return Math.round(float * 100);
}

/** Копійки → "150.50" (для value в input[type=number]) */
export function kopecksToInput(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
