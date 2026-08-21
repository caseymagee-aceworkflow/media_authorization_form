// Lets the viewer either generate a brand new MAF or pick an already-generated one (for
// this campaign) to regenerate in place. `records` is {id, name}[] - name is the MAF's own
// Period Label, already human-readable. Selecting "Create New" (the empty option) is the
// default, matching today's behavior before this feature existed.
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
