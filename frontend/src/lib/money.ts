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
 *  "150" → 15000, "150.50" → 15050, "150,50" → 15050.
 *  Прибирає звичайні та нерозривні пробіли (тисячні роздільники uk-UA).
 *  Кидає Error при невалідному введенні — форма перехопить у catch. */
export function parseMoney(input: string): number {
  // \u00a0 = no-break space, \u202f = narrow no-break space (uk-UA thousands sep)
  const normalized = input.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const float = parseFloat(normalized);
  if (isNaN(float) || !isFinite(float)) {
    throw new Error("Невалідна сума");
  }
  return Math.round(float * 100);
}

/** Копійки → "150.50" (для value в input[type=number]) */
export function kopecksToInput(kopecks: number): string {
  return (kopecks / 100).toFixed(2);
}
