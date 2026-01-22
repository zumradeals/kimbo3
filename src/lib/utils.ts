import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * ARRONDI COMPTABLE DAF - Règle stricte
 * Arrondit un montant financier au chiffre supérieur (ceil)
 * Ne doit JAMAIS être appliqué aux quantités
 * 
 * @param amount - Le montant à arrondir
 * @returns Le montant arrondi au supérieur
 * 
 * Exemples:
 * - 12345.01 → 12346
 * - 10000.50 → 10001
 * - 5000.00 → 5000 (pas de changement si entier)
 */
export function roundMontant(amount: number | null | undefined): number {
  if (amount === null || amount === undefined || isNaN(amount)) return 0;
  return Math.ceil(amount);
}

/**
 * Calcule le total d'une ligne (quantité × prix unitaire) avec arrondi comptable
 * La quantité reste intacte, seul le résultat est arrondi au supérieur
 * 
 * @param quantity - La quantité (non arrondie)
 * @param unitPrice - Le prix unitaire
 * @returns Le total arrondi au supérieur
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return roundMontant(quantity * unitPrice);
}

/**
 * Formate un montant en FCFA avec séparateur de milliers
 * Applique automatiquement l'arrondi comptable au supérieur
 * 
 * @param amount - Le montant à formater
 * @param options - Options de formatage
 * @returns Le montant formaté (ex: "12 346 FCFA")
 */
export function formatMontant(
  amount: number | null | undefined, 
  options: { showCurrency?: boolean; currency?: string } = {}
): string {
  const { showCurrency = true, currency = 'FCFA' } = options;
  const rounded = roundMontant(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return showCurrency ? `${formatted} ${currency}` : formatted;
}

/**
 * Formate un montant pour Intl.NumberFormat avec arrondi comptable
 * @param amount - Le montant à formater
 * @returns Le montant arrondi formaté selon la locale fr-FR
 */
export function formatMontantLocale(amount: number | null | undefined): string {
  const rounded = roundMontant(amount);
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}
