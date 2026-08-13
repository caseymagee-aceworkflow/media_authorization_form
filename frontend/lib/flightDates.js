// Computes the overall flight window across a set of Media Plan line items.
// There's no campaign-level flight-date field today, so this is derived client-side
// from the min Flight Start / max Flight End across the linked rows.
export function computeFlightDates(lineItems) {
    const starts = lineItems.map(item => item.flightStart).filter(Boolean);
    const ends = lineItems.map(item => item.flightEnd).filter(Boolean);

    if (starts.length === 0 || ends.length === 0) {
        return {start: null, end: null};
    }

    const start = starts.reduce((min, d) => (d < min ? d : min));
    const end = ends.reduce((max, d) => (d > max ? d : max));
    return {start, end};
}
