/**
 * Utilitaires pour le formatage des devises
 */

// Mapping des codes de devise vers leurs symboles
const currencySymbols: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  CAD: '$',
  JPY: '¥',
  CNY: '¥',
  MAD: 'MAD',
  XOF: 'XOF',
  XPF: 'XPF',
};

// Mapping des codes de devise vers leurs locales pour le formatage
const currencyLocales: Record<string, string> = {
  EUR: 'fr-FR',
  USD: 'en-US',
  GBP: 'en-GB',
  CHF: 'fr-CH',
  CAD: 'en-CA',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  MAD: 'ar-MA',
  XOF: 'fr-SN',
  XPF: 'fr-NC',
};

// Devises sans décimales (comme le Yen japonais)
const noDecimalCurrencies = ['JPY', 'XOF', 'XPF'];

/**
 * Obtenir le symbole d'une devise
 */
export function getCurrencySymbol(currencyCode: string = 'EUR'): string {
  return currencySymbols[currencyCode] || currencyCode;
}

/**
 * Formater un montant avec la devise
 * @param amount - Le montant à formater
 * @param currencyCode - Le code de la devise (ex: EUR, USD, XPF)
 * @param options - Options de formatage
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'EUR',
  options: {
    compact?: boolean; // Utiliser le format compact (ex: 12.5k)
    decimals?: number; // Nombre de décimales (par défaut: 2, ou 0 pour certaines devises)
    showSymbol?: boolean; // Afficher le symbole (par défaut: true)
  } = {}
): string {
  const { compact = false, showSymbol = true } = options;
  const symbol = getCurrencySymbol(currencyCode);

  // Déterminer le nombre de décimales
  const defaultDecimals = noDecimalCurrencies.includes(currencyCode) ? 0 : 2;
  const decimals = options.decimals ?? defaultDecimals;

  // Format: point pour milliers, virgule pour décimales
  const formattedAmount = amount
    .toFixed(decimals)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Position du symbole selon la devise
  if (!showSymbol) {
    return formattedAmount;
  }

  // Pour EUR, le symbole est généralement après le montant en français
  if (['EUR', 'XOF', 'XPF', 'MAD', 'CHF'].includes(currencyCode)) {
    return `${formattedAmount} ${symbol}`;
  }

  // Pour les autres devises (USD, GBP, etc.), le symbole est avant
  return `${symbol}${formattedAmount}`;
}

/**
 * Formater un montant pour les transactions (avec signe + ou -)
 */
export function formatTransactionAmount(
  amount: number,
  type: 'revenue' | 'expense',
  currencyCode: string = 'EUR'
): string {
  const sign = type === 'revenue' ? '+' : '-';
  const formatted = formatCurrency(Math.abs(amount), currencyCode);
  return `${sign}${formatted}`;
}

/**
 * Obtenir le placeholder pour un champ de montant
 */
export function getAmountPlaceholder(currencyCode: string = 'EUR'): string {
  const symbol = getCurrencySymbol(currencyCode);
  if (noDecimalCurrencies.includes(currencyCode)) {
    return `0 ${symbol}`;
  }
  return `0.00 ${symbol}`;
}
