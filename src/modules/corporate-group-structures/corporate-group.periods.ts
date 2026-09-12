import type { Attribute, OwnershipPercentage, OwnershipSegment, Period } from "./corporate-group.types.js";

/** Anything the registry stamps with a validity period (and usually a last-updated time). */
export interface Dated {
    periode: Period;
    sidstOpdateret?: string | null;
}

/** The yyyy-mm-dd part of a registry date, which may carry a time zone suffix. */
export function isoDay(value: string | null | undefined): string | null {
    return value ? value.slice(0, 10) : null;
}

/**
 * The entry that applies on `asOf` (ISO yyyy-mm-dd), or — when `asOf` is null —
 * the currently valid entry (no gyldigTil). Registry periods are inclusive on
 * both ends. Where corrected registrations overlap, the most recently updated
 * entry wins, then the one that started last.
 */
export function valueAt<T extends Dated>(values: readonly T[] | null | undefined, asOf: string | null): T | undefined {
    if (!values) return undefined;

    if (asOf === null) return values.find((value) => value.periode?.gyldigTil === null);

    return values
        .filter((value) => {
            const from = isoDay(value.periode?.gyldigFra);
            const to = isoDay(value.periode?.gyldigTil);
            return from !== null && from <= asOf && (to === null || to >= asOf);
        })
        .sort(
            (a, b) =>
                (b.sidstOpdateret ?? "").localeCompare(a.sidstOpdateret ?? "") ||
                b.periode.gyldigFra.localeCompare(a.periode.gyldigFra),
        )[0];
}

/** The value of a company attribute (KAPITAL, REGNSKABSÅR_START, …) on `asOf`, or null. */
export function attributeValueAt(attributter: Attribute[] | undefined, type: string, asOf: string | null): string | null {
    return valueAt(attributter?.find((attr) => attr.type === type)?.vaerdier, asOf)?.vaerdi ?? null;
}

/** The registry reports ownership as the lower bound of a band; this widens it to the band. */
export function bandOf(decimal: number | null): OwnershipPercentage {
    const interval = ((): { from: number | null; to: number | null } => {
        switch (decimal) {
            case 0:
                return { from: 0, to: 0.0499 };
            case 0.05:
                return { from: 0.05, to: 0.0999 };
            case 0.1:
                return { from: 0.1, to: 0.1499 };
            case 0.15:
                return { from: 0.15, to: 0.1999 };
            case 0.2:
                return { from: 0.2, to: 0.2499 };
            case 0.25:
                return { from: 0.25, to: 0.3332 };
            case 0.3333:
                return { from: 0.3333, to: 0.4999 };
            case 0.5:
                return { from: 0.5, to: 0.6666 };
            case 0.6667:
                return { from: 0.6667, to: 0.8999 };
            case 0.9:
                return { from: 0.9, to: 0.9999 };
            case 1:
                return { from: 1, to: 1 };
            default:
                return { from: null, to: null };
        }
    })();

    return { interval, accurate: decimal === 1, label: bandLabel(interval) };
}

export function toDecimal(value: string | null | undefined): number | null {
    if (!value) return null;
    const decimal = parseFloat(value);
    return Number.isFinite(decimal) ? decimal : null;
}

/** The ownership-register values of one attribute type across an owner relation's member data. */
export type AttributeValues = Attribute["vaerdier"];

/**
 * One segment per registered ownership value, in chronological order, each
 * paired with the voting rights and notice date that applied when it started.
 */
export function buildOwnershipHistory(
    ownership: AttributeValues,
    votingRights: AttributeValues,
    noticeDates: AttributeValues,
): OwnershipSegment[] {
    return ownership
        .map((value) => {
            const from = isoDay(value.periode.gyldigFra) ?? "";
            return {
                from,
                to: isoDay(value.periode.gyldigTil),
                noticeDate: isoDay(valueAt(noticeDates, from)?.vaerdi ?? null),
                ownershipPercentage: bandOf(toDecimal(value.vaerdi)),
                votingRightsPercentage: bandOf(toDecimal(valueAt(votingRights, from)?.vaerdi)),
            };
        })
        .sort((a, b) => a.from.localeCompare(b.from) || (a.to ?? "9999").localeCompare(b.to ?? "9999"));
}

/** The span from the first registered ownership to the end of the last one (null while still owned). */
export function membershipOf(history: OwnershipSegment[]): { from: string; to: string | null } | null {
    if (history.length === 0) return null;

    const from = history.map((segment) => segment.from).sort()[0];
    const to = history.some((segment) => segment.to === null)
        ? null
        : history.map((segment) => segment.to as string).sort().at(-1)!;

    return { from, to };
}

/** A closed date range (ISO yyyy-mm-dd, inclusive); `to` null = open-ended. */
export interface DateRange {
    from: string;
    to: string | null;
}

/** A closed window of interest (both ends inclusive). */
export interface DateWindow {
    from: string;
    to: string;
}

const MS_PER_DAY = 86_400_000;

function dayNumber(iso: string): number {
    return Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / MS_PER_DAY);
}

/** Whether a range touches the window at all. */
export function overlapsWindow(range: DateRange, window: DateWindow): boolean {
    return range.from <= window.to && (range.to === null || range.to >= window.from);
}

/**
 * Merges ranges that overlap or abut (next day) into continuous stints, oldest
 * first — e.g. an ownership registered as 2016..2018 and 2018-10-23..now is one
 * stint, while 2016..2018 and 2021..now are two (the company left and came back).
 */
export function stintsOf(ranges: readonly DateRange[]): DateRange[] {
    const sorted = ranges
        .filter((range) => range.from)
        .map((range) => ({ from: range.from.slice(0, 10), to: range.to ? range.to.slice(0, 10) : null }))
        .sort((a, b) => a.from.localeCompare(b.from));

    const stints: DateRange[] = [];
    for (const range of sorted) {
        const last = stints[stints.length - 1];
        const continues = last && (last.to === null || dayNumber(range.from) <= dayNumber(last.to) + 1);
        if (!continues) {
            stints.push({ ...range });
        } else if (last.to !== null && (range.to === null || range.to > last.to)) {
            last.to = range.to;
        }
    }
    return stints;
}

/** The latest day within `window` on which any of the stints applied, or null when none does. */
export function latestDayIn(stints: readonly DateRange[], window: DateWindow): string | null {
    return (
        stints
            .filter((stint) => overlapsWindow(stint, window))
            .map((stint) => (stint.to === null || stint.to > window.to ? window.to : stint.to))
            .sort()
            .at(-1) ?? null
    );
}

export type GroupEventType =
    | "JOINED"
    | "LEFT"
    | "OWNERSHIP_CHANGED"
    | "OWNER_CHANGED"
    | "DISSOLVED"
    | "MERGED_INTO"
    | "MERGED_FROM"
    | "SPLIT_INTO"
    | "SPLIT_FROM";

/** Something that happened to a company's place in the group on a date. */
export interface GroupEvent {
    date: string;
    type: GroupEventType;
    /** OWNERSHIP_CHANGED: the segment that applied before, and the one from `date`. */
    before?: Pick<OwnershipSegment, "ownershipPercentage" | "votingRightsPercentage">;
    after?: Pick<OwnershipSegment, "ownershipPercentage" | "votingRightsPercentage">;
    /** OWNER_CHANGED: the group company that owned it before `date`. */
    previousParent?: { name: string; cvr: number };
    /** MERGED_INTO, MERGED_FROM, SPLIT_INTO, SPLIT_FROM: the other parties of the merger/demerger. */
    counterparts?: Array<{ cvr: number; name: string; role: "TRANSFERRING" | "RECEIVING"; dissolved: boolean }>;
    /** MERGED_INTO/SPLIT_INTO: whether this company ceased to exist in the event. */
    dissolved?: boolean;
}

/** Display label for an ownership band: "25–33,32 %", "100 %", or null. */
export function bandLabel(interval: { from: number | null; to: number | null }): string | null {
    if (interval.from === null || interval.to === null) return null;
    const pct = (v: number) => (Math.round(v * 10000) / 100).toLocaleString("da-DK", { maximumFractionDigits: 2 });
    return interval.from === interval.to ? `${pct(interval.from)} %` : `${pct(interval.from)}–${pct(interval.to)} %`;
}

/** Maps the registry's last status text to a dissolution reason. */
export function dissolutionReasonOf(status: string | null): "MERGER" | "DEMERGER" | "LIQUIDATION" | "BANKRUPTCY" | "OTHER" | null {
    if (!status) return null;
    const s = status.toUpperCase();
    if (!/OPLØST|SLETTET|TVANGSOPLØST|OPHØRT/.test(s)) return null;
    if (/FUSION/.test(s)) return "MERGER";
    if (/SPALTNING/.test(s)) return "DEMERGER";
    if (/KONKURS/.test(s)) return "BANKRUPTCY";
    if (/LIKVIDATION/.test(s)) return "LIQUIDATION";
    return "OTHER";
}

function sameBand(a: OwnershipPercentage, b: OwnershipPercentage): boolean {
    return a.interval.from === b.interval.from && a.interval.to === b.interval.to;
}

const inWindow = (date: string | null, window: DateWindow): date is string =>
    date !== null && date >= window.from && date <= window.to;

/**
 * Derives what happened to one parent→company relation inside `window`:
 * JOINED/LEFT at the ends of each membership stint, OWNERSHIP_CHANGED where a
 * new ownership value differs from the previous one, and DISSOLVED when the
 * company ceased to exist. Sorted by date.
 */
export function deriveEvents(
    stints: readonly DateRange[],
    history: readonly OwnershipSegment[],
    window: DateWindow,
    dateOfDissolution: string | null,
): GroupEvent[] {
    const events: GroupEvent[] = [];

    for (const stint of stints) {
        if (inWindow(stint.from, window)) events.push({ date: stint.from, type: "JOINED" });
        if (inWindow(stint.to, window)) events.push({ date: stint.to, type: "LEFT" });
    }

    const segments = [...history].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < segments.length; i++) {
        const previous = segments[i - 1];
        const current = segments[i];
        // Only a change within one stint counts; a new stint after a gap is a JOINED.
        const contiguous = previous.to !== null && dayNumber(current.from) <= dayNumber(previous.to) + 1;
        if (!contiguous || !inWindow(current.from, window)) continue;
        if (
            sameBand(previous.ownershipPercentage, current.ownershipPercentage) &&
            sameBand(previous.votingRightsPercentage, current.votingRightsPercentage)
        ) {
            continue;
        }
        events.push({
            date: current.from,
            type: "OWNERSHIP_CHANGED",
            before: { ownershipPercentage: previous.ownershipPercentage, votingRightsPercentage: previous.votingRightsPercentage },
            after: { ownershipPercentage: current.ownershipPercentage, votingRightsPercentage: current.votingRightsPercentage },
        });
    }

    if (inWindow(dateOfDissolution, window)) events.push({ date: dateOfDissolution, type: "DISSOLVED" });

    return events.sort((a, b) => a.date.localeCompare(b.date));
}

/** Danish participant role of an owner in a company of the given legal form. */
export function participantRoleOf(
    formAbbreviation: string | null,
    isOwner: boolean,
    isFullyLiable: boolean,
): string | null {
    const form = (formAbbreviation ?? "").toUpperCase().replace(/\s/g, "");
    if (form === "K/S") {
        if (isFullyLiable && isOwner) return "KOMPLEMENTAR_OG_KOMMANDITIST";
        if (isFullyLiable) return "KOMPLEMENTAR";
        return isOwner ? "KOMMANDITIST" : null;
    }
    if (form === "P/S") {
        if (isFullyLiable && isOwner) return "KOMPLEMENTAR_OG_KOMMANDITAKTIONÆR";
        if (isFullyLiable) return "KOMPLEMENTAR";
        return isOwner ? "KOMMANDITAKTIONÆR" : null;
    }
    if (form === "I/S") return isFullyLiable || isOwner ? "INTERESSENT" : null;
    return isFullyLiable ? "FULDT_ANSVARLIG_DELTAGER" : null;
}
