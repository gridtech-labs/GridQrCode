/**
 * Currency symbol map.
 * Usage: currencySymbol("INR") → "₹"
 */
const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹",
  AED: "د.إ", CAD: "CA$", AUD: "A$", SGD: "S$",
  JPY: "¥", CNY: "¥", BRL: "R$", MXN: "MX$",
  ZAR: "R", CHF: "CHF", SEK: "kr", NOK: "kr",
  DKK: "kr", THB: "฿", IDR: "Rp", PHP: "₱",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "$";
  return SYMBOLS[code.toUpperCase()] ?? code + " ";
}

export function formatCurrency(amount: number, code?: string | null): string {
  const sym = currencySymbol(code);
  return `${sym}${amount.toFixed(2)}`;
}
