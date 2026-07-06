export interface CurrencyRate {
    /** The date that was requested (ISO yyyy-mm-dd). */
    requestedDate: string;
    /** The actual banking day the rate comes from (may be earlier than requested). */
    rateDate: string;
    /** Currency code, e.g. "EUR". */
    currency: string;
    /** Nationalbanken's description, e.g. "Euro". */
    description: string;
    /** Rate per 100 units — as Nationalbanken quotes it. */
    ratePer100: number;
    /** Rate per 1 unit (ratePer100 / 100). */
    rate: number;
}
