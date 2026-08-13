import {useState} from 'react';

// Lets whoever is using the interface - not just whoever has Designer/build access - choose
// which Media Plan fields appear as line-item columns, and reorder them. The properties
// panel (see App.jsx's useCustomProperties) still sets the starting defaults for anyone who
// opens the page, but this control lets each viewer override that on the spot; it's plain
// React state, so a reload resets to the panel defaults rather than persisting per viewer.
export default function ColumnPicker({availableFields, selectedFieldIds, onChange, maxColumns}) {
    const [isOpen, setIsOpen] = useState(false);

    const selectedFields = selectedFieldIds.map(id => availableFields.find(f => f.id === id)).filter(Boolean);
    const unselectedFields = availableFields.filter(f => !selectedFieldIds.includes(f.id));
    const atMax = selectedFields.length >= maxColumns;

    function addField(fieldId) {
        if (atMax) return;
        onChange([...selectedFieldIds, fieldId]);
    }

    function removeField(fieldId) {
        onChange(selectedFieldIds.filter(id => id !== fieldId));
    }

    function moveField(fieldId, direction) {
        const index = selectedFieldIds.indexOf(fieldId);
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= selectedFieldIds.length) return;
        const next = [...selectedFieldIds];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        onChange(next);
    }

    return (
        <div className="no-print relative">
            <button
                className="px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50"
                onClick={() => setIsOpen(open => !open)}
            >
                Columns ({selectedFields.length})
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-72 rounded border border-gray-gray300 bg-white shadow-lg z-10 p-3 text-sm dark:bg-gray-gray700 dark:border-gray-gray600">
                    <p className="text-xs font-semibold text-gray-gray400 uppercase mb-2">Shown columns (in order)</p>
                    {selectedFields.length === 0 && <p className="text-xs text-gray-gray400 mb-2">No columns selected.</p>}
                    <ul className="mb-3 divide-y divide-gray-gray100">
                        {selectedFields.map((field, i) => (
                            <li key={field.id} className="flex items-center justify-between py-1.5 gap-2">
                                <span className="truncate">{field.name}</span>
                                <span className="flex gap-1 shrink-0">
                                    <button
                                        className="px-1 text-gray-gray400 hover:text-gray-gray700 disabled:opacity-30"
                                        onClick={() => moveField(field.id, -1)}
                                        disabled={i === 0}
                                        aria-label={`Move ${field.name} up`}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        className="px-1 text-gray-gray400 hover:text-gray-gray700 disabled:opacity-30"
                                        onClick={() => moveField(field.id, 1)}
                                        disabled={i === selectedFields.length - 1}
                                        aria-label={`Move ${field.name} down`}
                                    >
                                        ↓
                                    </button>
                                    <button
                                        className="px-1 text-red-red hover:opacity-70"
                                        onClick={() => removeField(field.id)}
                                        aria-label={`Remove ${field.name}`}
                                    >
                                        ✕
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs font-semibold text-gray-gray400 uppercase mb-2">
                        Add a column{atMax ? ` (max ${maxColumns})` : ''}
                    </p>
                    <ul className="max-h-40 overflow-y-auto divide-y divide-gray-gray100">
                        {unselectedFields.map(field => (
                            <li key={field.id}>
                                <button
                                    className="w-full text-left py-1.5 hover:bg-gray-gray50 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-gray800"
                                    onClick={() => addField(field.id)}
                                    disabled={atMax}
                                >
                                    {field.name}
                                </button>
                            </li>
                        ))}
                        {unselectedFields.length === 0 && (
                            <li className="py-1.5 text-xs text-gray-gray400">All fields are already shown.</li>
                        )}
                    </ul>
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
