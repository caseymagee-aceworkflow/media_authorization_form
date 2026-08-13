export function formatCurrency(value) {
    const n = typeof value === 'number' ? value : 0;
    return `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Renders an ISO date string ("2026-02-01") as M/D/YYYY, matching the sample document.
export function formatDate(isoDateString) {
    if (!isoDateString) return '';
    const [year, month, day] = isoDateString.split('-');
    if (!year || !month || !day) return isoDateString;
    return `${Number(month)}/${Number(day)}/${year}`;
}

export function formatDateRange(startIso, endIso) {
    if (!startIso || !endIso) return '';
    return `${formatDate(startIso)} - ${formatDate(endIso)}`;
}
