import {useState} from 'react';
import {getFiscalYearOptions, formatPeriodLabel} from '../lib/fiscalPeriods';

const QUARTERS = [1, 2, 3, 4];

// Orders the two endpoints so start <= end regardless of which select the viewer touched
// last - e.g. picking an End before adjusting Start shouldn't produce an inverted range.
function normalizePeriod({startYear, startQuarter, endYear, endQuarter}) {
    const a = startYear * 4 + startQuarter;
    const b = endYear * 4 + endQuarter;
    if (a <= b) return {startYear, startQuarter, endYear, endQuarter};
    return {startYear: endYear, startQuarter: endQuarter, endYear: startYear, endQuarter: startQuarter};
}

// Required before SaveToRecordButton is enabled (see App.jsx) - period is `null` until the
// viewer makes an explicit choice here, at which point every control already carries a full
// {startYear, startQuarter, endYear, endQuarter} object built from sensible fallbacks, so the
// very first interaction produces a valid period.
export default function PeriodPicker({flightStart, flightEnd, fiscalStartMonth, period, onChange}) {
    const [isOpen, setIsOpen] = useState(false);
    const yearOptions = getFiscalYearOptions(flightStart, flightEnd, fiscalStartMonth);
    const fallbackYear = yearOptions[yearOptions.length - 1];

    const startYear = period?.startYear ?? fallbackYear;
    const startQuarter = period?.startQuarter ?? 1;
    const endYear = period?.endYear ?? fallbackYear;
    const endQuarter = period?.endQuarter ?? 4;
    // Gated on `period` actually being set (not just the fallback values happening to look
    // like a whole year) - otherwise the checkbox renders checked before the viewer has made
    // any real choice, while SaveToRecordButton (which only cares about the real `period`
    // state) stays disabled, making the button look broken until something is unchecked.
    const isWholeYear = Boolean(period) && startQuarter === 1 && endQuarter === 4 && startYear === endYear;

    function updateField(field, value) {
        onChange(normalizePeriod({startYear, startQuarter, endYear, endQuarter, [field]: value}));
    }

    function handleWholeYearToggle(checked) {
        // Turning it off drops to that same year's Q1 as a non-surprising starting point
        // for then adjusting Start/End independently.
        const quarter = checked ? {startQuarter: 1, endQuarter: 4} : {startQuarter: 1, endQuarter: 1};
        onChange({startYear, endYear: startYear, ...quarter});
    }

    const label = period ? formatPeriodLabel(period) : 'Select a period';

    return (
        <div className="no-print relative">
            <button
                className="px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50"
                onClick={() => setIsOpen(open => !open)}
            >
                Period: {label}
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-72 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded border border-gray-gray300 bg-white shadow-lg z-10 p-3 text-sm dark:bg-gray-gray700 dark:border-gray-gray600">
                    {yearOptions.length === 0 ? (
                        <p className="text-xs text-gray-gray400">No flight dates available for this campaign yet.</p>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-gray600 dark:text-gray-gray200">
                                <input
                                    type="checkbox"
                                    checked={isWholeYear}
                                    onChange={e => handleWholeYearToggle(e.target.checked)}
                                />
                                Whole Fiscal Year
                            </label>

                            {isWholeYear ? (
                                <select
                                    className="w-full border border-gray-gray300 rounded px-2 py-1"
                                    value={startYear}
                                    onChange={e => {
                                        const year = Number(e.target.value);
                                        onChange({startYear: year, startQuarter: 1, endYear: year, endQuarter: 4});
                                    }}
                                >
                                    {yearOptions.map(y => (
                                        <option key={y} value={y}>
                                            Fiscal Year {y}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <p className="text-xs font-semibold text-gray-gray400 uppercase mb-1">From</p>
                                    <div className="flex gap-2 mb-3">
                                        <select
                                            className="flex-1 border border-gray-gray300 rounded px-2 py-1"
                                            value={startQuarter}
                                            onChange={e => updateField('startQuarter', Number(e.target.value))}
                                        >
                                            {QUARTERS.map(q => (
                                                <option key={q} value={q}>
                                                    Q{q}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="flex-1 border border-gray-gray300 rounded px-2 py-1"
                                            value={startYear}
                                            onChange={e => updateField('startYear', Number(e.target.value))}
                                        >
                                            {yearOptions.map(y => (
                                                <option key={y} value={y}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs font-semibold text-gray-gray400 uppercase mb-1">To</p>
                                    <div className="flex gap-2 mb-2">
                                        <select
                                            className="flex-1 border border-gray-gray300 rounded px-2 py-1"
                                            value={endQuarter}
                                            onChange={e => updateField('endQuarter', Number(e.target.value))}
                                        >
                                            {QUARTERS.map(q => (
                                                <option key={q} value={q}>
                                                    Q{q}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="flex-1 border border-gray-gray300 rounded px-2 py-1"
                                            value={endYear}
                                            onChange={e => updateField('endYear', Number(e.target.value))}
                                        >
                                            {yearOptions.map(y => (
                                                <option key={y} value={y}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    <button
                        className="mt-3 w-full px-3 py-1.5 text-sm font-semibold rounded border border-gray-gray300 hover:bg-gray-gray50 dark:hover:bg-gray-gray800"
                        onClick={() => setIsOpen(false)}
                    >
                        Done
                    </button>
                </div>
            )}
        </div>
    );
}
