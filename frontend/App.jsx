import {useEffect, useMemo, useRef, useState} from 'react';
import {useBase, useCustomProperties, useRecords, useSearchParams} from '@airtable/blocks/interface/ui';
import {MEDIA_PLAN_FIELDS, MEDIA_PLAN_TABLE_ID, FALLBACK_FISCAL_LABEL, LEGAL_TEMPLATE} from './lib/constants';
import {computeFlightDates} from './lib/flightDates';
import {formatCurrency} from './lib/formatters';
import RecordPicker from './components/RecordPicker';
import DataPage from './components/DataPage';
import LegalPage from './components/LegalPage';
import PrintButton from './components/PrintButton';
import SaveToRecordButton from './components/SaveToRecordButton';
import ColumnPicker from './components/ColumnPicker';
import BackToCampaignButton from './components/BackToCampaignButton';

// This custom element is scoped not just to a single table, but to a specific subset of
// that table's fields too - some fields that genuinely exist on the table throw "Field
// does not exist" when read from here. hasField() checks accessibility before every read
// so the app degrades gracefully (shows "N/A"/omits data) instead of crashing on a field
// that isn't exposed to this element (re-check this in Interface Designer's Data panel
// after switching tables - the accessible-field list is per-table and won't carry over).
function safeGetValue(record, fieldId, hasField) {
    return hasField(fieldId) ? record.getCellValue(fieldId) : null;
}

function safeGetString(record, fieldId, hasField) {
    return hasField(fieldId) ? record.getCellValueAsString(fieldId) : '';
}

// The line-items table's columns are configurable (which Media Plan fields show, and in
// what order) via the Interface Designer properties panel, using the SDK's own
// useCustomProperties mechanism - not something we hardcode. Up to 6 field-picker slots,
// each independently optional; defaulting the first 5 to the fields already in use today
// so nothing changes for anyone who doesn't touch the properties panel.
const COLUMN_COUNT = 6;
const DEFAULT_COLUMN_FIELD_IDS = [
    MEDIA_PLAN_FIELDS.site,
    MEDIA_PLAN_FIELDS.country,
    MEDIA_PLAN_FIELDS.packageTactic,
    MEDIA_PLAN_FIELDS.currentAdjustedBudget,
    MEDIA_PLAN_FIELDS.totalCommission,
];

// Module-level (not defined inside a component) so this has the stable identity
// useCustomProperties requires - it doesn't close over any component state, since `base`
// arrives as an argument from the hook itself.
function getCustomProperties(base) {
    const table = base.getTableByIdIfExists(MEDIA_PLAN_TABLE_ID);
    if (!table) return [];
    return Array.from({length: COLUMN_COUNT}, (_, i) => {
        const defaultField = DEFAULT_COLUMN_FIELD_IDS[i] && table.getFieldByIdIfExists(DEFAULT_COLUMN_FIELD_IDS[i]);
        return {
            key: `column${i + 1}`,
            label: `Column ${i + 1}`,
            type: 'field',
            table,
            ...(defaultField ? {defaultValue: defaultField} : {}),
        };
    });
}

// Numeric-ish field types are right-aligned in the table; everything else left-aligned.
const NUMERIC_FIELD_TYPES = new Set(['currency', 'number', 'percent', 'duration', 'rating', 'count']);

// Extracts only the fields DataPage/LegalPage need from a Media Plan record, rather than
// passing the raw Record instance around. columnValues holds the configurable table
// columns; the rest (flight dates, stats) are fixed regardless of column configuration.
// Currency columns are formatted with formatCurrency (2 decimals + commas, same as the
// stat boxes) rather than left at whatever decimal precision the field happens to be
// configured with in Airtable - otherwise two currency columns can show inconsistent
// decimal places side by side in the same row.
function toLineItem(record, columns, hasField) {
    return {
        id: record.id,
        flightStart: safeGetValue(record, MEDIA_PLAN_FIELDS.flightStart, hasField),
        flightEnd: safeGetValue(record, MEDIA_PLAN_FIELDS.flightEnd, hasField),
        currentAdjustedBudget: safeGetValue(record, MEDIA_PLAN_FIELDS.currentAdjustedBudget, hasField),
        totalCommission: safeGetValue(record, MEDIA_PLAN_FIELDS.totalCommission, hasField),
        columnValues: columns.map(field => {
            if (field.type !== 'currency') return safeGetString(record, field.id, hasField);
            const value = safeGetValue(record, field.id, hasField);
            return value === null ? '' : formatCurrency(value);
        }),
    };
}

// null (not 0) when the field isn't accessible to this element - a real $0.00 would
// misleadingly imply a verified zero rather than "not available".
function sumStat(lineItems, key, fieldId, hasField) {
    if (!hasField(fieldId)) return null;
    return lineItems.reduce((sum, item) => sum + (item[key] || 0), 0);
}

function todayIsoDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Diagnostic view shown when the Media Plan table isn't found in the connected base -
// lets us see exactly what base/tables the running extension actually sees, rather than
// guessing from outside.
function TableMismatchDiagnostic({base}) {
    return (
        <div className="p-8 text-sm">
            <p className="font-semibold text-red-red">
                Expected table not found in base &quot;{base.name}&quot; ({base.id}).
            </p>
            <p className="mt-2 text-gray-gray500">
                Looking for Media Plan ({MEDIA_PLAN_TABLE_ID}). Tables actually visible in this base:
            </p>
            <ul className="mt-2 list-disc pl-5">
                {base.tables.map(t => (
                    <li key={t.id}>
                        {t.name} ({t.id})
                    </li>
                ))}
            </ul>
        </div>
    );
}

// This custom element is currently restricted to a single connected table (Media Plan),
// so "which campaign" is derived from Media Plan's own link back to Campaign rather than
// reading Campaign directly. Once multi-table support is available (needs an admin to
// enable AI Labs), this can go back to reading Campaign's own records/fields directly -
// see lib/constants.js's CAMPAIGN_FIELDS, left in place for that migration.
//
// Only mounted once mediaPlanTable is confirmed to exist, so hooks below are always
// called in the same order - the existence check lives in App, one level up.
function CampaignDocumentApp({mediaPlanTable}) {
    const mediaPlanRecords = useRecords(mediaPlanTable);
    const hasField = useMemo(
        () => fieldId => Boolean(mediaPlanTable.getFieldByIdIfExists(fieldId)),
        [mediaPlanTable],
    );

    // The properties panel (Designer/build-time only) sets the starting column selection;
    // ColumnPicker below lets anyone actually using the interface change it live. Local
    // state seeds itself from the panel defaults once useCustomProperties resolves them,
    // then stays put on top so a viewer's choice doesn't get overwritten by a re-render.
    const {customPropertyValueByKey} = useCustomProperties(getCustomProperties);
    const defaultColumnFieldIds = useMemo(() => {
        return Array.from({length: COLUMN_COUNT}, (_, i) => customPropertyValueByKey[`column${i + 1}`])
            .filter(Boolean)
            .map(field => field.id);
    }, [customPropertyValueByKey]);

    const [columnFieldIds, setColumnFieldIds] = useState(null);
    useEffect(() => {
        if (columnFieldIds === null && defaultColumnFieldIds.length > 0) {
            setColumnFieldIds(defaultColumnFieldIds);
        }
    }, [columnFieldIds, defaultColumnFieldIds]);
    const effectiveColumnFieldIds = columnFieldIds ?? defaultColumnFieldIds;

    const availableFields = mediaPlanTable.fields;
    const columns = useMemo(() => {
        return effectiveColumnFieldIds.map(id => mediaPlanTable.getFieldByIdIfExists(id)).filter(Boolean);
    }, [effectiveColumnFieldIds, mediaPlanTable]);

    const campaigns = useMemo(() => {
        const byId = new Map();
        mediaPlanRecords.forEach(record => {
            const links = safeGetValue(record, MEDIA_PLAN_FIELDS.campaign, hasField) || [];
            links.forEach(link => {
                if (!byId.has(link.id)) byId.set(link.id, {id: link.id, name: link.name});
            });
        });
        return Array.from(byId.values());
    }, [mediaPlanRecords, hasField]);

    // Deep-linking: a link/button on another Interface page can point straight at a
    // campaign via ?campaignId=recXXX, so a viewer never has to search for it manually here.
    const {searchParams, setSearchParamsAsync} = useSearchParams();
    const [selectedCampaignId, setSelectedCampaignId] = useState(() => searchParams.campaignId || null);

    // lastSyncedCampaignId tracks whichever value we last reconciled (from either
    // direction) so the two effects below don't fight each other / loop.
    const lastSyncedCampaignId = useRef(selectedCampaignId);

    // Inbound: adopt the URL's campaignId when it changes to something we didn't just
    // write ourselves - this is what makes a click-through link from another page work.
    useEffect(() => {
        const paramValue = searchParams.campaignId || null;
        if (paramValue !== lastSyncedCampaignId.current) {
            lastSyncedCampaignId.current = paramValue;
            setSelectedCampaignId(paramValue);
        }
    }, [searchParams.campaignId]);

    // Outbound: keep the URL in sync with the current selection, so this page's own
    // address stays bookmarkable/shareable after a manual pick in RecordPicker too.
    useEffect(() => {
        if (selectedCampaignId === lastSyncedCampaignId.current) return;
        lastSyncedCampaignId.current = selectedCampaignId;
        setSearchParamsAsync({campaignId: selectedCampaignId || ''}).catch(() => {});
    }, [selectedCampaignId, setSearchParamsAsync]);

    const selectedCampaign = useMemo(
        () => campaigns.find(c => c.id === selectedCampaignId) || null,
        [campaigns, selectedCampaignId],
    );

    const documentData = useMemo(() => {
        if (!selectedCampaign) return null;

        const campaignLineItemRecords = mediaPlanRecords.filter(record =>
            (safeGetValue(record, MEDIA_PLAN_FIELDS.campaign, hasField) || []).some(
                link => link.id === selectedCampaign.id,
            ),
        );
        if (campaignLineItemRecords.length === 0) return null;

        const lineItems = campaignLineItemRecords.map(r => toLineItem(r, columns, hasField));
        const flightDates = computeFlightDates(lineItems);
        // Client is a lookup through the Campaign link (verified via get_table_schema), so
        // it's readable from any line item without needing direct Campaign table access -
        // all rows for a campaign resolve to the same client, so the first is enough.
        const clientLegalName =
            safeGetString(campaignLineItemRecords[0], MEDIA_PLAN_FIELDS.client, hasField) ||
            LEGAL_TEMPLATE.clientLegalName;

        return {
            title: selectedCampaign.name,
            clientLegalName,
            // Fiscal Year only lives on Campaign, which isn't reachable from this
            // single-table build - hardcoded until multi-table access is restored.
            fiscalLabel: FALLBACK_FISCAL_LABEL,
            todaysDate: todayIsoDate(),
            flightDates,
            stats: {
                currentAdjustedBudget: sumStat(
                    lineItems,
                    'currentAdjustedBudget',
                    MEDIA_PLAN_FIELDS.currentAdjustedBudget,
                    hasField,
                ),
                totalCommission: sumStat(lineItems, 'totalCommission', MEDIA_PLAN_FIELDS.totalCommission, hasField),
            },
            columns: columns.map(field => ({
                id: field.id,
                name: field.name,
                numeric: NUMERIC_FIELD_TYPES.has(field.type),
            })),
            lineItems,
        };
    }, [selectedCampaign, mediaPlanRecords, columns, hasField]);

    if (!selectedCampaign || !documentData) {
        return (
            <RecordPicker
                records={campaigns}
                selectedId={selectedCampaignId}
                onSelect={setSelectedCampaignId}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="no-print p-4 flex items-center justify-between gap-4 border-b border-gray-gray200 bg-white dark:bg-gray-gray700">
                <RecordPicker
                    records={campaigns}
                    selectedId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                    compact
                />
                <div className="flex gap-2">
                    <ColumnPicker
                        availableFields={availableFields}
                        selectedFieldIds={effectiveColumnFieldIds}
                        onChange={setColumnFieldIds}
                        maxColumns={COLUMN_COUNT}
                    />
                    <SaveToRecordButton
                        campaignRecordId={selectedCampaign.id}
                        columnFieldIds={columns.map(field => field.id)}
                    />
                    <PrintButton />
                    <BackToCampaignButton />
                </div>
            </div>
            <div className="maf-document">
                <DataPage data={documentData} />
                <LegalPage data={documentData} />
            </div>
        </div>
    );
}

export default function App() {
    const base = useBase();
    const mediaPlanTable = base.getTableByIdIfExists(MEDIA_PLAN_TABLE_ID);

    if (!mediaPlanTable) {
        return <TableMismatchDiagnostic base={base} />;
    }

    return <CampaignDocumentApp mediaPlanTable={mediaPlanTable} />;
}
