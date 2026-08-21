// Fiscal-quarter date math for the MAF period picker.
//
// Convention (documented assumption - nothing in the base schema defines this explicitly,
// and it's currently unobservable since every real client's Fiscal Year Start Date is
// January): "Fiscal Year N" starts in `fiscalStartMonth` of calendar year N. Q1 is that
// month and the following two; Q2/Q3/Q4 each start 3/6/9 months later, rolling into the
// next calendar year as needed. With fiscalStartMonth=1 this is exactly calendar quarters.

function pad2(n) {
    return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, oneBasedMonth) {
    // Date.UTC's month is 0-based, so passing the 1-based month as-is with day 0 lands on
    // the last day of the *previous* (0-based) month - i.e. the last day of oneBasedMonth.
    return new Date(Date.UTC(year, oneBasedMonth, 0)).getUTCDate();
}

// Maps a fiscal year + a 0-based month offset from that fiscal year's start into a real
// calendar {year, month} (1-based month), rolling over into the next calendar year once the
// offset carries past December.
function fiscalOffsetToCalendar(fiscalYear, monthOffset, fiscalStartMonth) {
    const total = fiscalStartMonth - 1 + monthOffset;
    return {
        year: fiscalYear + Math.floor(total / 12),
        month: (total % 12) + 1,
    };
}

export function getFiscalYearForDate(isoDate, fiscalStartMonth) {
    const [year, month] = isoDate.split('-').map(Number);
    if (fiscalStartMonth === 1) return year;
    return month >= fiscalStartMonth ? year : year - 1;
}

export function getQuarterForDate(isoDate, fiscalStartMonth) {
    const [, month] = isoDate.split('-').map(Number);
    const monthOffset = (month - fiscalStartMonth + 12) % 12;
    return Math.floor(monthOffset / 3) + 1;
}

// Every fiscal year that any part of [startIso, endIso] touches, in order - used to build
// the period picker's Year dropdown options from a campaign's own flight-date span.
export function getFiscalYearOptions(startIso, endIso, fiscalStartMonth) {
    if (!startIso || !endIso) return [];
    const startFY = getFiscalYearForDate(startIso, fiscalStartMonth);
    const endFY = getFiscalYearForDate(endIso, fiscalStartMonth);
    const years = [];
    for (let fy = startFY; fy <= endFY; fy++) years.push(fy);
    return years;
}

export function getFiscalQuarterRange(fiscalYear, quarterNum, fiscalStartMonth) {
    const startOffset = (quarterNum - 1) * 3;
    const start = fiscalOffsetToCalendar(fiscalYear, startOffset, fiscalStartMonth);
    const end = fiscalOffsetToCalendar(fiscalYear, startOffset + 2, fiscalStartMonth);
    return {
        start: `${start.year}-${pad2(start.month)}-01`,
        end: `${end.year}-${pad2(end.month)}-${pad2(lastDayOfMonth(end.year, end.month))}`,
    };
}

export function getPeriodRange({startYear, startQuarter, endYear, endQuarter}, fiscalStartMonth) {
    const {start} = getFiscalQuarterRange(startYear, startQuarter, fiscalStartMonth);
    const {end} = getFiscalQuarterRange(endYear, endQuarter, fiscalStartMonth);
    return {start, end};
}

export function formatPeriodLabel({startYear, startQuarter, endYear, endQuarter}) {
    if (startYear === endYear && startQuarter === 1 && endQuarter === 4) {
        return `Fiscal Year ${startYear}`;
    }
    if (startYear === endYear && startQuarter === endQuarter) {
        return `Q${startQuarter} ${startYear}`;
    }
    return `Q${startQuarter} ${startYear} - Q${endQuarter} ${endYear}`;
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart <= bEnd && bStart <= aEnd;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Client's "Fiscal Year Start Date" is a singleSelect of month names, not a number - this
// converts it to the 1-12 fiscalStartMonth every function above expects.
export function monthNameToNumber(name) {
    const index = MONTH_NAMES.indexOf(name);
    return index === -1 ? null : index + 1;
}
