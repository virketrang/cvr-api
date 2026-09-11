/**
 * Normalizes a CVR number to the canonical 8-digit, zero-padded string form.
 * Mirrors the VBA client's Utilities.NormalizeCvr: strip everything but digits,
 * then keep the last 8 characters of "00000000" + digits.
 */
export function normalizeCvr(cvr: string | number): string {
    const digits = String(cvr).replace(/\D/g, "");
    return `00000000${digits}`.slice(-8);
}
