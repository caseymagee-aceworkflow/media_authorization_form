import {useState} from 'react';

// The installed Interface Extensions SDK (interface-alpha) has no cursor/selected-record
// hook, so this element manages its own record selection rather than inheriting one from
// the page it's placed on.
export default function RecordPicker({records, selectedId, onSelect, compact = false}) {
    const [search, setSearch] = useState('');
    const filtered = search
        ? records.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
        : records;

    if (compact) {
        return (
            <select
                className="text-sm border border-gray-gray300 rounded px-2 py-1 bg-white dark:bg-gray-gray800 dark:text-gray-gray200"
                value={selectedId || ''}
                onChange={e => onSelect(e.target.value || null)}
            >
                <option value="">Select a campaign…</option>
                {records.map(r => (
                    <option key={r.id} value={r.id}>
                        {r.name}
                    </option>
                ))}
            </select>
        );
    }

    return (
        <div className="p-4 sm:p-8 min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="rounded-lg p-6 sm:p-8 max-w-xl mx-auto mt-6 bg-white shadow-sm dark:bg-gray-gray700">
                <h1 className="text-xl font-display font-bold text-gray-gray700 dark:text-gray-gray200">
                    Media Authorization Form
                </h1>
                <p className="text-sm text-gray-gray400 mt-1 mb-4">
                    Choose a campaign to generate its document.
                </p>
                <input
                    type="text"
                    placeholder="Search campaigns…"
                    className="w-full border border-gray-gray300 rounded px-3 py-2 mb-3 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-gray200">
                    {filtered.map(r => (
                        <li key={r.id}>
                            <button
                                className="w-full text-left px-2 py-2 text-sm hover:bg-gray-gray50 dark:hover:bg-gray-gray800 dark:text-gray-gray200"
                                onClick={() => onSelect(r.id)}
                            >
                                {r.name || '(unnamed campaign)'}
                            </button>
                        </li>
                    ))}
                    {filtered.length === 0 && (
                        <li className="px-2 py-4 text-sm text-gray-gray400">No campaigns match.</li>
                    )}
                </ul>
            </div>
        </div>
    );
}
