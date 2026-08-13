import {formatCurrency} from '../lib/formatters';

export default function StatBox({label, value}) {
    return (
        <div className="text-center px-2">
            <div className="text-lg font-bold text-gray-gray700">
                {value === null ? 'N/A' : formatCurrency(value)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-gray400 mt-0.5">{label}</div>
        </div>
    );
}
