import {useEffect, useMemo, useRef, useState} from 'react';
import {useBase, useCustomProperties, useRecords, useSearchParams} from '@airtable/blocks/interface/ui';
import {
    MEDIA_PLAN_FIELDS,
    MEDIA_PLAN_TABLE_ID,
    MONTHLY_PLAN_FIELDS,
    MONTHLY_PLAN_TABLE_ID,
    FALLBACK_FISCAL_LABEL,
    LEGAL_TEMPLATE,
} from './lib/constants';
import {computeFlightDates} from './lib/flightDates';
import {formatCurrency} from './lib/formatters';
import {
    getFiscalYearForDate,
    getQuarterForDate,
    getPeriodRange,
    formatPeriodLabel,
    rangesOverlap,
    monthNameToNumber,
} from './lib/fiscalPeriods';
import RecordPicker from './components/RecordPicker';
import DataPage from './components/DataPage';
import LegalPage from './components/LegalPage';
import SaveToRecordButton from './components/SaveToRecordButton';
import ColumnPicker from './components/ColumnPicker';
import PeriodPicker from './components/PeriodPicker';
import MafRecordPicker from './components/MafRecordPicker';
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

// multipleLookupValues fields don't hand back the looked-up field's native shape directly -
// the SDK wraps every entry as {linkedRecordId, value} (see @airtable/blocks's
// record_core.js's getCellValue()), where `value` holds the actual looked-up value (which
// may itself be an object, e.g. {id, name} when looking up a link field). Every raw
// safeGetValue() read of a lookup field needs this unwrap, or callers silently see undefined.
function lookupValues(record, fieldId, hasField) {
    const raw = safeGetValue(record, fieldId, hasField) || [];
    return raw.map(entry => entry?.value);
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
// passing the raw Record instance around. `stats` (currentAdjustedBudget/totalCommission)
// is resolved by the caller beforehand - either the record's own full-flight rollups, or
// prorated sums over just the months inside the selected period - so this function doesn't
// need to know which. Currency columns are formatted with formatCurrency (2 decimals +
// commas, same as the stat boxes); the two dollar-figure columns specifically substitute
// `stats` instead of re-reading the record's raw (always full-flight) rollup fields, so the
// table and the stat boxes never disagree when a period is active.
function toLineItem(record, columns, hasField, stats) {
    return {
        id: record.id,
        flightStart: safeGetValue(record, MEDIA_PLAN_FIELDS.flightStart, hasField),
        flightEnd: safeGetValue(record, MEDIA_PLAN_FIELDS.flightEnd, hasField),
        currentAdjustedBudget: stats.currentAdjustedBudget,
        totalCommission: stats.totalCommission,
        columnValues: columns.map(field => {
            if (field.id === MEDIA_PLAN_FIELDS.currentAdjustedBudget) {
                return stats.currentAdjustedBudget == null ? '' : formatCurrency(stats.currentAdjustedBudget);
            }
            if (field.id === MEDIA_PLAN_FIELDS.totalCommission) {
                return stats.totalCommission == null ? '' : formatCurrency(stats.totalCommission);
            }
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

// This custom element is currently restricted to at most two connected tables (Media Plan,
// and now Monthly Plan for period prorating), so "which campaign" is derived from Media
// Plan's own link back to Campaign rather than reading Campaign directly. Once multi-table
// access covers Campaign too, this can go back to reading Campaign's own records/fields
// directly - see lib/constants.js's CAMPAIGN_FIELDS, left in place for that migration.
//
// Only mounted once mediaPlanTable is confirmed to exist, so hooks below are always
// called in the same order - the existence check lives in App, one level up.
function CampaignDocumentApp({mediaPlanTable, monthlyPlanTable}) {
    const mediaPlanRecords = useRecords(mediaPlanTable);
    const monthlyPlanRecords = useRecords(monthlyPlanTable ?? null);
    const hasField = useMemo(
        () => fieldId => Boolean(mediaPlanTable.getFieldByIdIfExists(fieldId)),
        [mediaPlanTable],
    );
    // Monthly Plan is an optional second connection (needs an admin to enable multi-table
    // support for this element, then add it in Designer) - guarded everywhere it's read so
    // the rest of the app keeps working, just without period-prorated dollar figures, until
    // that's done.
    const hasMonthlyPlanField = useMemo(
        () => fieldId => Boolean(monthlyPlanTable && monthlyPlanTable.getFieldByIdIfExists(fieldId)),
        [monthlyPlanTable],
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

    // Every Media Plan row for the selected campaign, regardless of period - the base set
    // that period selection (below) filters down from, and where fiscal-quarter basis /
    // existing-MAF-record data is read from (any one row is enough, since every row for a
    // campaign shares the same client and the same campaign-level MAF history).
    const campaignRecordsUnfiltered = useMemo(() => {
        if (!selectedCampaign) return [];
        return mediaPlanRecords.filter(record =>
            (safeGetValue(record, MEDIA_PLAN_FIELDS.campaign, hasField) || []).some(
                link => link.id === selectedCampaign.id,
            ),
        );
    }, [selectedCampaign, mediaPlanRecords, hasField]);

    const fiscalStartMonth = useMemo(() => {
        if (campaignRecordsUnfiltered.length === 0) return 1;
        const values = lookupValues(campaignRecordsUnfiltered[0], MEDIA_PLAN_FIELDS.fiscalYearStartDate, hasField);
        return monthNameToNumber(values[0]) ?? 1;
    }, [campaignRecordsUnfiltered, hasField]);

    // Period selection and the "update an existing MAF" choice are per-campaign, transient
    // action state - not deep-linked via useSearchParams (unlike campaignId above), and
    // reset whenever the campaign changes so a leftover period from a different campaign
    // never silently carries over.
    const [period, setPeriod] = useState(null);
    const [selectedMafRecordId, setSelectedMafRecordId] = useState(null);
    // Set once SaveToRecordButton's request resolves - collapses the toolbar down to just
    // "Back to Campaign" (see the render below).
    const [hasSaved, setHasSaved] = useState(false);
    useEffect(() => {
        setPeriod(null);
        setSelectedMafRecordId(null);
        setHasSaved(false);
    }, [selectedCampaignId]);

    const periodRange = useMemo(
        () => (period ? getPeriodRange(period, fiscalStartMonth) : null),
        [period, fiscalStartMonth],
    );

    // Existing MAF records for this campaign, read via the lookup-through-Campaign fields
    // (Campaign MAF Records / Period Starts / Period Ends are index-aligned, per
    // lib/constants.js) - powers MafRecordPicker's "update existing" option.
    const mafRecordOptions = useMemo(() => {
        if (campaignRecordsUnfiltered.length === 0) return [];
        const first = campaignRecordsUnfiltered[0];
        // Each entry's `value` is itself a link value ({id, name}), since the looked-up
        // field (Campaign's own "MAF Records") is a Link field - see lookupValues() above.
        const links = lookupValues(first, MEDIA_PLAN_FIELDS.mafRecords, hasField);
        const starts = lookupValues(first, MEDIA_PLAN_FIELDS.mafPeriodStarts, hasField);
        const ends = lookupValues(first, MEDIA_PLAN_FIELDS.mafPeriodEnds, hasField);
        return links.map((link, i) => ({
            id: link?.id,
            name: link?.name,
            periodStart: starts[i] || null,
            periodEnd: ends[i] || null,
        }));
    }, [campaignRecordsUnfiltered, hasField]);

    // Scoped to the currently selected period so the "update existing" picker only ever
    // offers records that actually match what's being generated right now - a Period Label
    // alone wouldn't be enough to disambiguate once every option in this list necessarily
    // covers the exact same period.
    const matchingMafRecords = useMemo(
        () =>
            periodRange
                ? mafRecordOptions.filter(r => r.periodStart === periodRange.start && r.periodEnd === periodRange.end)
                : [],
        [mafRecordOptions, periodRange],
    );

    // Selecting an existing MAF pre-fills the period picker from its stored dates (still
    // editable afterward) rather than forcing a fresh pick every time.
    function selectMafRecord(mafId) {
        setSelectedMafRecordId(mafId);
        const match = mafId && mafRecordOptions.find(r => r.id === mafId);
        if (match?.periodStart && match?.periodEnd) {
            setPeriod({
                startYear: getFiscalYearForDate(match.periodStart, fiscalStartMonth),
                startQuarter: getQuarterForDate(match.periodStart, fiscalStartMonth),
                endYear: getFiscalYearForDate(match.periodEnd, fiscalStartMonth),
                endQuarter: getQuarterForDate(match.periodEnd, fiscalStartMonth),
            });
        }
    }

    // A line item is INCLUDED if its flight overlaps the period at all; its dollar figures
    // are then separately prorated (below) to just the months inside the period - these are
    // two different filters over two different granularities, both intentional.
    const includedRecords = useMemo(() => {
        if (!periodRange) return campaignRecordsUnfiltered;
        return campaignRecordsUnfiltered.filter(record => {
            const flightStart = safeGetValue(record, MEDIA_PLAN_FIELDS.flightStart, hasField);
            const flightEnd = safeGetValue(record, MEDIA_PLAN_FIELDS.flightEnd, hasField);
            return rangesOverlap(flightStart, flightEnd, periodRange.start, periodRange.end);
        });
    }, [campaignRecordsUnfiltered, periodRange, hasField]);

    // Whether dollar figures for the current view are genuinely prorated (Monthly Plan
    // connected) or just today's full-flight totals for whichever lines are included (not
    // yet connected) - surfaced to the viewer via documentData.periodCaveat rather than
    // silently showing numbers that look period-specific but aren't.
    const canProrate = Boolean(monthlyPlanTable) && hasMonthlyPlanField(MONTHLY_PLAN_FIELDS.mediaPlan);

    const getLineStats = useMemo(() => {
        const periodStartMonth = periodRange?.start.slice(0, 7);
        const periodEndMonth = periodRange?.end.slice(0, 7);
        return record => {
            if (!periodRange || !canProrate) {
                return {
                    currentAdjustedBudget: safeGetValue(record, MEDIA_PLAN_FIELDS.currentAdjustedBudget, hasField),
                    totalCommission: safeGetValue(record, MEDIA_PLAN_FIELDS.totalCommission, hasField),
                };
            }
            const monthsInPeriod = monthlyPlanRecords.filter(row => {
                const links = safeGetValue(row, MONTHLY_PLAN_FIELDS.mediaPlan, hasMonthlyPlanField) || [];
                if (!links.some(link => link.id === record.id)) return false;
                const recordOrder = safeGetString(row, MONTHLY_PLAN_FIELDS.recordOrder, hasMonthlyPlanField);
                return recordOrder >= periodStartMonth && recordOrder <= periodEndMonth;
            });
            const sum = fieldId =>
                monthsInPeriod.reduce((total, row) => total + (safeGetValue(row, fieldId, hasMonthlyPlanField) || 0), 0);
            return {
                currentAdjustedBudget: sum(MONTHLY_PLAN_FIELDS.adjustedBudget),
                totalCommission: sum(MONTHLY_PLAN_FIELDS.commission),
            };
        };
    }, [periodRange, canProrate, monthlyPlanRecords, hasField, hasMonthlyPlanField]);

    const documentData = useMemo(() => {
        if (!selectedCampaign || campaignRecordsUnfiltered.length === 0) return null;

        const lineItems = includedRecords.map(r => toLineItem(r, columns, hasField, getLineStats(r)));
        const flightDates = computeFlightDates(lineItems);
        // Client is a lookup through the Campaign link (verified via get_table_schema), so
        // it's readable from any line item without needing direct Campaign table access -
        // all rows for a campaign resolve to the same client, so the first is enough.
        const clientLegalName =
            safeGetString(campaignRecordsUnfiltered[0], MEDIA_PLAN_FIELDS.client, hasField) ||
            LEGAL_TEMPLATE.clientLegalName;

        return {
            title: selectedCampaign.name,
            clientLegalName,
            fiscalLabel: period ? formatPeriodLabel(period) : FALLBACK_FISCAL_LABEL,
            todaysDate: todayIsoDate(),
            flightDates,
            periodStart: periodRange?.start ?? null,
            periodEnd: periodRange?.end ?? null,
            periodCaveat:
                period && !canProrate
                    ? 'Monthly Plan isn’t connected to this element yet - dollar figures below are full-flight totals for the included lines, not prorated to this period.'
                    : null,
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
    }, [
        selectedCampaign,
        campaignRecordsUnfiltered,
        includedRecords,
        columns,
        hasField,
        getLineStats,
        period,
        periodRange,
        canProrate,
    ]);

    if (!selectedCampaign || !documentData) {
        return (
            <RecordPicker
                records={campaigns}
                selectedId={selectedCampaignId}
                onSelect={setSelectedCampaignId}
            />
        );
    }

    const campaignFlightDates = computeFlightDates(
        campaignRecordsUnfiltered.map(r => ({
            flightStart: safeGetValue(r, MEDIA_PLAN_FIELDS.flightStart, hasField),
            flightEnd: safeGetValue(r, MEDIA_PLAN_FIELDS.flightEnd, hasField),
        })),
    );

    return (
        <div className="min-h-screen bg-gray-gray50 dark:bg-gray-gray800">
            <div className="no-print p-4 flex items-center justify-between gap-4 border-b border-gray-gray200 bg-white dark:bg-gray-gray700 flex-wrap">
                <RecordPicker
                    records={campaigns}
                    selectedId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                    compact
                />
                <div className="flex gap-2 flex-wrap">
                    {!hasSaved && (
                        <>
                            <ColumnPicker
                                availableFields={availableFields}
                                selectedFieldIds={effectiveColumnFieldIds}
                                onChange={setColumnFieldIds}
                                maxColumns={COLUMN_COUNT}
                            />
                            <PeriodPicker
                                flightStart={campaignFlightDates.start}
                                flightEnd={campaignFlightDates.end}
                                fiscalStartMonth={fiscalStartMonth}
                                period={period}
                                onChange={setPeriod}
                            />
                            {period && (
                                <>
                                    <MafRecordPicker
                                        records={matchingMafRecords}
                                        selectedId={selectedMafRecordId}
                                        onSelect={selectMafRecord}
                                    />
                                    <SaveToRecordButton
                                        campaignRecordId={selectedCampaign.id}
                                        columnFieldIds={columns.map(field => field.id)}
                                        periodLabel={formatPeriodLabel(period)}
                                        periodStart={periodRange?.start ?? null}
                                        periodEnd={periodRange?.end ?? null}
                                        existingMafRecordId={selectedMafRecordId}
                                        onSaved={() => setHasSaved(true)}
                                    />
                                </>
                            )}
                        </>
                    )}
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
    // Optional - only present once an admin connects it as a second data source for this
    // element (see lib/constants.js's MONTHLY_PLAN_TABLE_ID comment). CampaignDocumentApp
    // degrades gracefully (full-flight totals instead of prorated ones) when this is null.
    const monthlyPlanTable = base.getTableByIdIfExists(MONTHLY_PLAN_TABLE_ID);

    if (!mediaPlanTable) {
        return <TableMismatchDiagnostic base={base} />;
    }

    return <CampaignDocumentApp mediaPlanTable={mediaPlanTable} monthlyPlanTable={monthlyPlanTable} />;
}
