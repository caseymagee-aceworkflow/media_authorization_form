// Lets the viewer either generate a brand new MAF or pick an already-generated one to
// regenerate in place. `records` is {id, name}[], already scoped by the caller to just the
// ones matching the currently selected period (App.jsx's matchingMafRecords) - every option
// here would otherwise show the same Period Label text, so a `records` list that isn't
// pre-filtered would make this genuinely ambiguous, not just cluttered. Selecting "Create
// New" (the empty option) is the default.
export default function MafRecordPicker({records, selectedId, onSelect}) {
    return (
        <select
            className="text-sm border border-gray-gray300 rounded px-2 py-1 bg-white dark:bg-gray-gray800 dark:text-gray-gray200"
            value={selectedId || ''}
            onChange={e => onSelect(e.target.value || null)}
        >
            <option value="">Create New MAF</option>
            {records.map(r => (
                <option key={r.id} value={r.id}>
                    Update: {r.name}
                </option>
            ))}
        </select>
    );
}
