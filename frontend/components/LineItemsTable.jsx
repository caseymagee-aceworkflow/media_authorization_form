// Columns are configurable (which Media Plan fields, and in what order) via the Interface
// Extension's properties panel - see App.jsx's useCustomProperties setup. Nothing here is
// hardcoded to a specific field.
//
// Plain <table>/<thead>/<tbody> (not divs) so the browser's print pagination
// behaves predictably if the table ever spans multiple printed pages.
export default function LineItemsTable({lineItems, columns}) {
    if (columns.length === 0) {
        return (
            <p className="mt-4 text-xs text-gray-gray400">
                No columns configured - add fields in the element&apos;s properties panel.
            </p>
        );
    }

    return (
        <table className="w-full text-xs border-collapse mt-4">
            <thead>
                <tr className="border-b-2 border-gray-gray700 text-left">
                    {columns.map(column => (
                        <th
                            key={column.id}
                            className={`py-1.5 pr-2 font-semibold ${column.numeric ? 'text-right' : ''}`}
                        >
                            {column.name}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {lineItems.map(item => (
                    <tr key={item.id} className="border-b border-gray-gray200">
                        {item.columnValues.map((value, i) => (
                            <td
                                key={columns[i].id}
                                className={`py-1 pr-2 ${columns[i].numeric ? 'text-right' : ''}`}
                            >
                                {value}
                            </td>
                        ))}
                    </tr>
                ))}
                {lineItems.length === 0 && (
                    <tr>
                        <td colSpan={columns.length} className="py-4 text-center text-gray-gray400">
                            No line items linked to this campaign.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
