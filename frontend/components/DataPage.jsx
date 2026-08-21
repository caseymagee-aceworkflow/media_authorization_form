import StatBox from './StatBox';
import LineItemsTable from './LineItemsTable';
import {formatDate, formatDateRange} from '../lib/formatters';

export default function DataPage({data}) {
    return (
        <div className="maf-page bg-white p-10">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold text-gray-gray700">Media Authorization Form</h1>
                    <p className="text-sm text-gray-gray500 mt-0.5">Digital Media Buy Authorization</p>
                    <p className="text-sm font-semibold text-gray-gray700 mt-2">
                        {data.title} {data.fiscalLabel}
                    </p>
                </div>
                <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Monks_Logo.png"
                    alt=".monks"
                    className="h-10 object-contain"
                />
            </div>

            <div className="mt-6 border border-gray-gray200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-gray-gray500">
                    <div>Today&apos;s Date: {formatDate(data.todaysDate)}</div>
                    <div className="mt-1">
                        Flight Dates: {formatDateRange(data.flightDates.start, data.flightDates.end)}
                    </div>
                    {data.periodStart && data.periodEnd && (
                        <div className="mt-1">Period: {formatDateRange(data.periodStart, data.periodEnd)}</div>
                    )}
                    {data.periodCaveat && <div className="mt-1 text-orange-orange">{data.periodCaveat}</div>}
                </div>
                <div className="flex gap-6">
                    <StatBox label="Current Adjusted Budget" value={data.stats.currentAdjustedBudget} />
                    <StatBox label="Total Commission" value={data.stats.totalCommission} />
                </div>
            </div>

            <LineItemsTable lineItems={data.lineItems} columns={data.columns} />
        </div>
    );
}
