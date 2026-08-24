// Airtable Automation "Run a script" action ("PDF Generator", wfl6lCrUcjhkZ7CLg).
//
// This is NOT part of the Interface Extension build/bundle - Automations have their own
// separate scripting environment (the classic Airtable Scripting API: base.getTable(),
// record.getCellValue(), etc.), which has full base access regardless of what fields/tables
// are connected to any Interface. Paste this file's contents directly into the script editor.
//
// SETUP (one-time, in Airtable's UI - none of this is scriptable via the API):
// 1. A button field can't trigger an automation from an Interface button - only a native
//    Interface button element can, which doesn't apply to a custom extension's own button.
//    So the trigger is a webhook instead: create an Automation with a webhook trigger,
//    action = "Run a script". The Interface extension's SaveToRecordButton.jsx POSTs to
//    the generated webhook URL (see lib/constants.js's GENERATE_ATTACHMENT_WEBHOOK_URL).
// 2. Map the webhook trigger's incoming fields (sent as application/x-www-form-urlencoded -
//    hooks.airtable.com rejects other Content-Types, confirmed via curl) into script input
//    variables, all type "Single line text": `recordId` (the Campaign record ID),
//    `columnFieldIds` (comma-joined Media Plan field IDs, mirrors the Interface Extension's
//    own configurable columns), `periodLabel` (e.g. "Q3 2026"), `periodStart` / `periodEnd`
//    (ISO dates, "YYYY-MM-DD"), and `existingMafRecordId` (empty string means "create a new
//    MAF record"; otherwise the MAF record to update in place).
// 3. Add a Personal Access Token scoped to data.records:write on this base only (create one
//    at https://airtable.com/create/tokens) as a **Secret** (not a plain input variable)
//    named `airtablePat`, via the script action's "Add existing secret" / secrets panel -
//    read with input.secret('airtablePat') below, not input.config().
// 4. Paste this entire file into the script body.

const CAMPAIGN_TABLE_ID = 'tblApzXRiH8nTBPtU';
const MEDIA_PLAN_TABLE_ID = 'tblHy85L1pZBxioOT';
const MONTHLY_PLAN_TABLE_ID = 'tblAExLLgHy1XAkE3';
const MAF_TABLE_ID = 'tblIgrgjUrNwKbYgH';

const CAMPAIGN_FIELDS = {
    campaignName: 'fldwfSiX6f8B7MXGr',
    mediaPlans: 'fldDh02dbQtnUKtwc',
    todaysDate: 'fldW4bq4AEkxjAi8J',
    client: 'fldyGTEvcfdtAwLWy', // link to the Client table
};

// flightStart/flightEnd are fixed (used for the Flight Dates line and period-overlap
// filtering, not table columns) - the line-items table's own columns are dynamic, see
// DEFAULT_COLUMN_FIELD_IDS below. currentAdjustedBudget/totalCommission are read only to
// detect when a configured column IS one of those two fields, so its displayed value can
// be swapped for the prorated figure - see buildColumnValue().
const MEDIA_PLAN_FIELDS = {
    flightStart: 'fldB2cmo3XmVX2nM5',
    flightEnd: 'fldWaLcSFgHKXGE0a',
    currentAdjustedBudget: 'fldmvjNGReswjPhKZ',
    totalCommission: 'fldGYhiz2WJTLD6lM',
};

// Monthly Plan ("Monthly Budget Lines" in the base UI) - one row per calendar month within
// a Media Plan's flight. adjustedBudget/commission are already-computed per-month formula
// fields that Media Plan's own full-flight rollups (currentAdjustedBudget/totalCommission
// above) sum across ALL of a plan's months (verified via get_table_schema) - prorating to a
// period means summing just these two fields for the months inside it, not reimplementing
// the budget/commission business logic here.
const MONTHLY_PLAN_FIELDS = {
    mediaPlan: 'fldQ9Hf1mL3WH7tFf',
    recordOrder: 'flddFUxLmoSCywuzl', // formula, "YYYY-MM", zero-padded and string-sortable
    adjustedBudget: 'fldmtBBITSyiUdK7R',
    commission: 'fldMlfsA8n1M9IqX8',
};

const MAF_FIELDS = {
    periodLabel: 'fldPt3dfaELRJ1SPM', // primary field
    campaign: 'fldaH1k0eqFY4r4Oy',
    periodStart: 'fldzuRVbofvoij98f',
    periodEnd: 'fldt1yWwXunX2JtCy',
    pdf: 'fldhAfFf0q0iEzYPV',
    status: 'fldk40JwEcwdZ6RL9',
    lastGeneratedAt: 'fldUHHCwdk4dT3Cfe',
    monthsApplied: 'fldnwWgG7HJMXZJ2j', // link to every Monthly Budget Line this MAF actually covers
};

// Matches the Interface Extension's own default column set (lib/constants.js) - used only
// when the webhook payload doesn't include a columnFieldIds value (e.g. before that input
// variable has been set up, or a request from something other than SaveToRecordButton).
const DEFAULT_COLUMN_FIELD_IDS = [
    'fldgWoTC09fphswbx', // Site
    'fldDntdz6zs6SYV24', // Country
    'fldqLXuxHXKJ9gMvQ', // Package/Tactic
    'fldmvjNGReswjPhKZ', // Current Adjusted Budget
    'fldGYhiz2WJTLD6lM', // Total Commission
];

// clientLegalName is a fallback only, used when a campaign has no linked Client record -
// the real name is read dynamically from Campaign's own Client link below.
const LEGAL_TEMPLATE = {
    clientLegalName: 'the Client',
    vendorName: 'Media.Monks',
    billingEntity: 'Decoded Advertising',
    workStatementDate: 'April 18th, 2024',
};

// ---------------------------------------------------------------------------
// Base64 encoder - hand-rolled because Automation scripts don't have Node's
// Buffer or a guaranteed btoa(), and this needs to run in whatever sandbox
// Airtable provides without any external dependency.
// ---------------------------------------------------------------------------
function toBase64(binaryString) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    for (; i + 3 <= binaryString.length; i += 3) {
        const b1 = binaryString.charCodeAt(i);
        const b2 = binaryString.charCodeAt(i + 1);
        const b3 = binaryString.charCodeAt(i + 2);
        result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] + chars[((b2 & 15) << 2) | (b3 >> 6)] + chars[b3 & 63];
    }
    const remaining = binaryString.length - i;
    if (remaining === 1) {
        const b1 = binaryString.charCodeAt(i);
        result += chars[b1 >> 2] + chars[(b1 & 3) << 4] + '==';
    } else if (remaining === 2) {
        const b1 = binaryString.charCodeAt(i);
        const b2 = binaryString.charCodeAt(i + 1);
        result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] + chars[(b2 & 15) << 2] + '=';
    }
    return result;
}

// Inverse of toBase64 - used once below to turn the embedded logo's base64 string back
// into a binary string (one JS char code per byte), the same convention buildPdfBytes
// uses for the rest of the PDF.
function fromBase64(base64String) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = base64String.replace(/[^A-Za-z0-9+/]/g, '');
    let result = '';
    for (let i = 0; i < clean.length; i += 4) {
        const c0 = chars.indexOf(clean[i]);
        const c1 = chars.indexOf(clean[i + 1]);
        const c2 = i + 2 < clean.length ? chars.indexOf(clean[i + 2]) : -1;
        const c3 = i + 3 < clean.length ? chars.indexOf(clean[i + 3]) : -1;
        result += String.fromCharCode(((c0 << 2) | (c1 >> 4)) & 0xff);
        if (c2 >= 0) result += String.fromCharCode((((c1 & 0xf) << 4) | (c2 >> 2)) & 0xff);
        if (c3 >= 0) result += String.fromCharCode((((c2 & 0x3) << 6) | c3) & 0xff);
    }
    return result;
}

// The same logo used by the polished Interface Extension (DataPage.jsx), pre-flattened
// onto a white background and downscaled to a small JPEG (240x73px) so it embeds cheaply -
// this is what makes matching the real logo possible without the script fetching or
// decoding anything at runtime. PDF's DCTDecode filter accepts raw JPEG bytes as-is, so
// this only needs base64-decoding, not real image decoding.
const LOGO_JPEG_BASE64 =
    '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/iYkAYHTOTX2wKACiiigAooooAKpahoWlas8cmo6ZZXjxfca4gSQp9CwOKu0UANMUbR+UUUx4xtI4x6YqD+zbL/nzt/+/S/4VZooAFUKAoAAHAA7VA2n2bsWa1gZickmMEk/lU9FADIYIrdSsMaRqTnCKAM/hTZrS3uGDTQRSEDALoDj86looAhis7aB98VvDG2MZVADU1FFAGZqfhbQdabfqmi6bfN03XNskh/MiotO8HeG9IkEunaBpVnIDkPBaRow/EDNbFFABUU1rb3BBmgikI4BdAcfnUtFAEMVlbQPvit4UbpuVADUrosilHUMpGCCMg0tFAFb+zbL/nzt/wDv0v8AhUklrBKipJDE6r91WUED6VLRQBAlhaRuHS2gVhyCIwCP0qeiigCt/Ztl/wA+dv8A9+l/wqWG1gt8+TDHHu67FAz+VSUUAY+p+DPDWsyNJqXh/SbyRuS89pG7H8SM1Wtvh14Os38y38K6HG46MtjHkfpXQ0UANjiSFFjjRURRgKowAPYU6iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//2Q==';
const LOGO_PIXEL_WIDTH = 240;
const LOGO_PIXEL_HEIGHT = 73;

// ---------------------------------------------------------------------------
// Minimal hand-written PDF writer - no library, just raw PDF syntax. Standard
// Helvetica/Helvetica-Bold only (no font embedding needed), so text is
// restricted to the printable ASCII range.
// ---------------------------------------------------------------------------
function pdfEscapeText(value) {
    return String(value == null ? '' : value)
        .replace(/[^\x20-\x7E]/g, '?')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function wrapText(text, maxCharsPerLine) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxCharsPerLine && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    });
    if (current) lines.push(current);
    return lines;
}

function createPageBuilder() {
    const ops = [];
    return {
        text(x, y, size, str) {
            ops.push(`BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscapeText(str)}) Tj ET`);
        },
        boldText(x, y, size, str) {
            ops.push(`BT /F2 ${size} Tf ${x} ${y} Td (${pdfEscapeText(str)}) Tj ET`);
        },
        line(x1, y1, x2, y2, width) {
            ops.push(`${width || 1} w 0 G ${x1} ${y1} m ${x2} ${y2} l S`);
        },
        // Draws the (single, shared) image XObject at (x, y) scaled to w x h points -
        // the CTM maps the image's unit square onto that rectangle, independent of its
        // native pixel dimensions.
        image(x, y, w, h) {
            ops.push(`q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`);
        },
        build() {
            return ops.join('\n');
        },
    };
}

// imageXObject is optional: {data (binary string of raw JPEG bytes), width, height} in
// pixels. When present, every page's Resources references it as /Im0 - a page that never
// calls .image() just never invokes it, so there's no cost to referencing it everywhere.
function buildPdfBytes(pageContents, imageXObject) {
    const objects = [];
    const catalogNum = 1;
    const pagesNum = 2;
    const fontRegularNum = 3;
    const fontBoldNum = 4;
    const imageNum = imageXObject ? 5 : null;

    objects[fontRegularNum - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[fontBoldNum - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    if (imageXObject) {
        objects[imageNum - 1] = {
            stream: imageXObject.data,
            dict:
                `/Type /XObject /Subtype /Image /Width ${imageXObject.width} /Height ${imageXObject.height} ` +
                `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
        };
    }

    let nextNum = imageXObject ? 6 : 5;
    const pageObjNums = [];
    const xObjectResource = imageXObject ? ` /XObject << /Im0 ${imageNum} 0 R >>` : '';
    pageContents.forEach(content => {
        const pageNum = nextNum++;
        const contentNum = nextNum++;
        pageObjNums.push(pageNum);
        objects[pageNum - 1] =
            `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 612 792] ` +
            `/Resources << /Font << /F1 ${fontRegularNum} 0 R /F2 ${fontBoldNum} 0 R >>${xObjectResource} >> ` +
            `/Contents ${contentNum} 0 R >>`;
        objects[contentNum - 1] = {stream: content};
    });

    objects[catalogNum - 1] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;
    objects[pagesNum - 1] = `<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 0; i < objects.length; i++) {
        offsets.push(pdf.length);
        const num = i + 1;
        const entry = objects[i];
        if (entry && typeof entry === 'object' && 'stream' in entry) {
            const extraDict = entry.dict ? `${entry.dict} ` : '';
            pdf += `${num} 0 obj\n<< ${extraDict}/Length ${entry.stream.length} >>\nstream\n${entry.stream}\nendstream\nendobj\n`;
        } else {
            pdf += `${num} 0 obj\n${entry}\nendobj\n`;
        }
    }

    const xrefOffset = pdf.length;
    const totalObjects = objects.length + 1;
    let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
    for (let i = 0; i < objects.length; i++) {
        xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += xref;
    pdf += `trailer\n<< /Size ${totalObjects} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
}

// The webhook trigger's payload came in as application/x-www-form-urlencoded (required -
// hooks.airtable.com rejects other Content-Types, confirmed via curl), and Airtable's
// webhook-payload mapping doesn't necessarily hand the mapped field to the script as a
// plain string - normalize whatever shape it actually arrives in.
function unwrapValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return unwrapValue(value[0]);
    if (value && typeof value === 'object') {
        if (typeof value.value === 'string') return value.value;
        if (typeof value.id === 'string') return value.id;
    }
    return null;
}

function normalizeRequiredText(value, label) {
    const unwrapped = unwrapValue(value);
    if (!unwrapped) throw new Error(`Missing required input: ${label}`);
    return unwrapped;
}

// Used for existingMafRecordId (empty = create new) and defensively for period fields -
// SaveToRecordButton always sends real values when it fires, but a request that predates
// one of these inputs being wired up, or that comes from somewhere else, shouldn't crash.
function normalizeOptionalText(value) {
    return unwrapValue(value) || '';
}

// Same shape-safety as above, plus its own fallback: an empty/missing value falls back to
// DEFAULT_COLUMN_FIELD_IDS rather than producing a blank table.
function normalizeColumnFieldIds(value) {
    const raw = unwrapValue(value);
    const ids = typeof raw === 'string' ? raw.split(',').map(id => id.trim()).filter(Boolean) : [];
    return ids.length > 0 ? ids : DEFAULT_COLUMN_FIELD_IDS;
}

function money(value) {
    if (value == null) return 'N/A';
    const [whole, cents] = value.toFixed(2).split('.');
    const negative = whole.startsWith('-');
    const digits = negative ? whole.slice(1) : whole;
    let withCommas = '';
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) withCommas += ',';
        withCommas += digits[i];
    }
    return `${negative ? '-' : ''}$${withCommas}.${cents}`;
}

// Rough Helvetica average character-width estimate (as a fraction of font size), used to
// approximate centering the stat box values/labels below - text() is left-anchored only,
// with no real font-metrics table to measure exact string width, so this is deliberately
// approximate rather than pixel-precise.
function estimateTextWidth(text, fontSize, bold) {
    return text.length * fontSize * (bold ? 0.58 : 0.5);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const inputConfig = input.config();
const campaignTable = base.getTable(CAMPAIGN_TABLE_ID);
const mediaPlanTable = base.getTable(MEDIA_PLAN_TABLE_ID);
const monthlyPlanTable = base.getTable(MONTHLY_PLAN_TABLE_ID);
const mafTable = base.getTable(MAF_TABLE_ID);

const campaignRecordId = normalizeRequiredText(inputConfig.recordId, 'recordId');
const periodLabel = normalizeRequiredText(inputConfig.periodLabel, 'periodLabel');
const periodStart = normalizeRequiredText(inputConfig.periodStart, 'periodStart');
const periodEnd = normalizeRequiredText(inputConfig.periodEnd, 'periodEnd');
const existingMafRecordId = normalizeOptionalText(inputConfig.existingMafRecordId);
const periodStartMonth = periodStart.slice(0, 7); // "YYYY-MM", for Record Order comparisons
const periodEndMonth = periodEnd.slice(0, 7);

// selectRecordAsync/selectRecordsAsync load every field on the table by default - Campaign
// and Media Plan both have dozens of rollup/lookup fields referencing OTHER linked tables,
// and resolving all of those cross-table dependencies is what actually burns through the
// 30-query-per-run quota, not the record count. Passing `fields` restricts this to just
// what's used below.
const campaignRecord = await campaignTable.selectRecordAsync(campaignRecordId, {
    fields: Object.values(CAMPAIGN_FIELDS),
});
if (!campaignRecord) {
    throw new Error(`Campaign record not found: ${campaignRecordId}`);
}

// Which fields show in the line-items table, and in what order, mirrors the Interface
// Extension's own configurable columns (App.jsx's useCustomProperties) - sent along with
// the webhook trigger at click time, since this script has no way to read that
// element's configuration directly.
const columnFieldIds = normalizeColumnFieldIds(inputConfig.columnFieldIds);
// A field that's since been deleted/renamed would make getField throw - skip it rather
// than fail the whole run over one bad column.
const columns = columnFieldIds
    .map(fieldId => {
        try {
            return mediaPlanTable.getField(fieldId);
        } catch {
            return null;
        }
    })
    .filter(Boolean);

const linkedIdSet = new Set((campaignRecord.getCellValue(CAMPAIGN_FIELDS.mediaPlans) || []).map(link => link.id));
const mediaPlanQuery = await mediaPlanTable.selectRecordsAsync({
    fields: [
        ...new Set([
            MEDIA_PLAN_FIELDS.flightStart,
            MEDIA_PLAN_FIELDS.flightEnd,
            ...columns.map(f => f.id),
        ]),
    ],
});
// A line item is INCLUDED if its flight overlaps the period at all; its dollar figures are
// then separately prorated (below) to just the months inside the period - mirrors App.jsx's
// two-filter approach exactly, so the live preview and this generated PDF never disagree.
const lineItemRecords = mediaPlanQuery.records.filter(record => {
    if (!linkedIdSet.has(record.id)) return false;
    const flightStart = record.getCellValue(MEDIA_PLAN_FIELDS.flightStart);
    const flightEnd = record.getCellValue(MEDIA_PLAN_FIELDS.flightEnd);
    if (!flightStart || !flightEnd) return false;
    return flightStart <= periodEnd && periodStart <= flightEnd;
});

const monthlyPlanQuery = await monthlyPlanTable.selectRecordsAsync({fields: Object.values(MONTHLY_PLAN_FIELDS)});

// Prorated {currentAdjustedBudget, totalCommission, monthRecordIds} for one Media Plan
// record - sums the already-computed per-month formula fields (see MONTHLY_PLAN_FIELDS
// comment) for just the months that fall inside [periodStartMonth, periodEndMonth].
// monthRecordIds is returned too so the caller can link the MAF record to exactly the
// Monthly Plan rows that fed into it, without re-deriving this same filter a second time.
function proratedStatsFor(mediaPlanRecordId) {
    const monthsInPeriod = monthlyPlanQuery.records.filter(row => {
        const links = row.getCellValue(MONTHLY_PLAN_FIELDS.mediaPlan) || [];
        if (!links.some(link => link.id === mediaPlanRecordId)) return false;
        const recordOrder = row.getCellValueAsString(MONTHLY_PLAN_FIELDS.recordOrder);
        return recordOrder >= periodStartMonth && recordOrder <= periodEndMonth;
    });
    const sum = fieldId => monthsInPeriod.reduce((total, row) => total + (row.getCellValue(fieldId) || 0), 0);
    return {
        currentAdjustedBudget: sum(MONTHLY_PLAN_FIELDS.adjustedBudget),
        totalCommission: sum(MONTHLY_PLAN_FIELDS.commission),
        monthRecordIds: monthsInPeriod.map(row => row.id),
    };
}

// Currency columns are run through money() (2 decimals + commas, matching the stat boxes)
// instead of getCellValueAsString, which mirrors each field's own configured decimal
// precision in Airtable. The two dollar-figure columns specifically substitute the prorated
// stats instead of the record's raw (always full-flight) rollup fields, same as App.jsx.
const lineItems = lineItemRecords.map(record => {
    const stats = proratedStatsFor(record.id);
    return {
        flightStart: record.getCellValue(MEDIA_PLAN_FIELDS.flightStart),
        flightEnd: record.getCellValue(MEDIA_PLAN_FIELDS.flightEnd),
        stats,
        columnValues: columns.map(field => {
            if (field.id === MEDIA_PLAN_FIELDS.currentAdjustedBudget) return money(stats.currentAdjustedBudget);
            if (field.id === MEDIA_PLAN_FIELDS.totalCommission) return money(stats.totalCommission);
            if (field.type !== 'currency') return record.getCellValueAsString(field.id);
            const value = record.getCellValue(field.id);
            return value == null ? '' : money(value);
        }),
    };
});

// Every Monthly Plan record that fed into any included line's prorated stats - a Set since
// in practice each Monthly Plan row belongs to exactly one Media Plan, but that's not worth
// relying on to avoid a double-linked record.
const monthsAppliedIds = new Set(lineItems.flatMap(item => item.stats.monthRecordIds));

const flightStarts = lineItems.map(i => i.flightStart).filter(Boolean).sort();
const flightEnds = lineItems.map(i => i.flightEnd).filter(Boolean).sort();
const flightRange =
    flightStarts.length && flightEnds.length
        ? `${flightStarts[0]} - ${flightEnds[flightEnds.length - 1]}`
        : 'N/A';

const title = campaignRecord.getCellValueAsString(CAMPAIGN_FIELDS.campaignName);
const todaysDate = campaignRecord.getCellValueAsString(CAMPAIGN_FIELDS.todaysDate);
const clientLegalName =
    campaignRecord.getCellValueAsString(CAMPAIGN_FIELDS.client) || LEGAL_TEMPLATE.clientLegalName;
// Sum of the already-prorated per-line stats, NOT Campaign's own full-flight rollups -
// these are the period-scoped totals, matching the stat boxes in the live preview exactly.
const currentAdjustedBudget = lineItems.reduce((sum, item) => sum + item.stats.currentAdjustedBudget, 0);
const totalCommission = lineItems.reduce((sum, item) => sum + item.stats.totalCommission, 0);

// --- Page 1: data ---
const page1 = createPageBuilder();
let y = 740;
page1.boldText(72, y, 16, 'Media Authorization Form');
page1.image(448, 716, 92, 28); // top-right, matching DataPage.jsx's logo placement
y -= 16;
page1.text(72, y, 10, 'Digital Media Buy Authorization');
y -= 16;
page1.boldText(72, y, 11, `${title} ${periodLabel}`);
y -= 30;

// Bordered summary box, mirroring DataPage.jsx's layout: date/flight info on the left,
// two stat blocks (bold value + label beneath) on the right.
const SUMMARY_BOX_TOP = y;
const SUMMARY_BOX_BOTTOM = y - 46;
page1.line(72, SUMMARY_BOX_TOP, 540, SUMMARY_BOX_TOP, 1);
page1.line(72, SUMMARY_BOX_BOTTOM, 540, SUMMARY_BOX_BOTTOM, 1);
page1.line(72, SUMMARY_BOX_TOP, 72, SUMMARY_BOX_BOTTOM, 1);
page1.line(540, SUMMARY_BOX_TOP, 540, SUMMARY_BOX_BOTTOM, 1);

page1.text(84, SUMMARY_BOX_TOP - 16, 9, `Today's Date: ${todaysDate}`);
page1.text(84, SUMMARY_BOX_TOP - 30, 9, `Flight Dates: ${flightRange} (Period: ${periodStart} - ${periodEnd})`);

const statBoxes = [
    {label: 'Current Adjusted Budget', value: money(currentAdjustedBudget)},
    {label: 'Total Commission', value: money(totalCommission)},
];
const STAT_BOX_WIDTH = 110;
const statsStartX = 540 - statBoxes.length * STAT_BOX_WIDTH;
statBoxes.forEach((stat, i) => {
    const boxCenterX = statsStartX + i * STAT_BOX_WIDTH + STAT_BOX_WIDTH / 2;
    page1.boldText(boxCenterX - estimateTextWidth(stat.value, 11, true) / 2, SUMMARY_BOX_TOP - 20, 11, stat.value);
    page1.text(boxCenterX - estimateTextWidth(stat.label, 7, false) / 2, SUMMARY_BOX_TOP - 32, 7, stat.label);
});

y = SUMMARY_BOX_BOTTOM - 20;

// Column widths split evenly across however many columns are configured (see `columns`
// above) - since these are arbitrary, user-chosen fields (not a fixed known set), every
// column gets the same treatment rather than special-casing any one of them.
const TABLE_LEFT = 72;
const TABLE_RIGHT = 540;
const colWidth = columns.length > 0 ? (TABLE_RIGHT - TABLE_LEFT) / columns.length : TABLE_RIGHT - TABLE_LEFT;
const colX = columns.map((_, i) => TABLE_LEFT + i * colWidth);
// Helvetica isn't monospace, so this is an approximation of how many characters fit per
// column at 8pt - derived from the same ~4.9pt/char ratio the legal paragraph's wrapping
// already uses (468pt / 95 chars), rounded down for safety. Headers wrap the same way data
// values do (the header row grows taller to fit) rather than being cut off, so a long field
// name is always fully readable.
const ROW_LINE_HEIGHT = 10;
const HEADER_LINE_HEIGHT = 9;
const CHARS_PER_LINE = Math.max(8, Math.floor(colWidth / 4.9) - 1);

page1.line(72, y, 540, y, 1);
y -= 14;
const wrappedHeaders = columns.map(field => wrapText(field.name, CHARS_PER_LINE));
const headerLineCount = Math.max(1, ...wrappedHeaders.map(lines => lines.length));
wrappedHeaders.forEach((lines, i) => {
    lines.forEach((line, lineIndex) => {
        page1.boldText(colX[i], y - lineIndex * HEADER_LINE_HEIGHT, 8, line);
    });
});
y -= (headerLineCount - 1) * HEADER_LINE_HEIGHT + 9;
page1.line(72, y, 540, y, 0.5);
y -= 12;

if (columns.length === 0) {
    page1.text(72, y, 9, 'No columns configured.');
    y -= 14;
}

lineItems.forEach(item => {
    if (y < 60) return; // simple page-1 line cap - this is the audit-trail copy, not the full document
    const wrappedColumns = item.columnValues.map(value => wrapText(value, CHARS_PER_LINE));
    const rowLineCount = Math.max(1, ...wrappedColumns.map(lines => lines.length));
    wrappedColumns.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => {
            page1.text(colX[i], y - lineIndex * ROW_LINE_HEIGHT, 8, line);
        });
    });
    y -= rowLineCount * ROW_LINE_HEIGHT;
});

if (lineItems.length === 0) {
    page1.text(72, y, 9, 'No line items overlap this period.');
}

// --- Page 2: legal + signatures ---
const page2 = createPageBuilder();
y = 740;
page2.boldText(
    72,
    y,
    10,
    `${clientLegalName.toUpperCase()} ISSUES APPROVAL TO ${LEGAL_TEMPLATE.vendorName.toUpperCase()} TO PURCHASE THE FOLLOWING:`,
);
y -= 24;

const legalParagraph =
    `For purposes of clarification, invoices will be payable to ${LEGAL_TEMPLATE.billingEntity}, solely for amounts ` +
    `actually and verifiably spent, regardless of the total budget provided for herein. Invoices shall be payable ` +
    `net 30 days. This Media Authorization Form ("MAF") shall not be effective until such time as it has been ` +
    `signed by both parties and returned. The parties hereby acknowledge that this MAF, along with the Work ` +
    `Statement effective ${LEGAL_TEMPLATE.workStatementDate} and the Advertising Services Agreement (the "Agreement") ` +
    `between ${clientLegalName} and ${LEGAL_TEMPLATE.vendorName} represent the entire agreement of the ` +
    `parties with respect to the services set forth herein and the parties acknowledge their agreement by a valid ` +
    `signature from an authorized representative. No changes to this MAF will be considered valid unless they have ` +
    `been made in writing executed by both parties. In the event of a conflict between the terms of this MAF and ` +
    `the Agreement, the terms of the Agreement shall govern. All investment listed on the MAF shall remain fluid ` +
    `across listed partners as need be for optimization purposes, so long as there is alignment from ` +
    `${clientLegalName}. Agency Fee is subject to the terms of SOW covering this time period.`;

wrapText(legalParagraph, 95).forEach(line => {
    page2.text(72, y, 9, line);
    y -= 13;
});

// Label + underscores in one string means each fillable line starts (and ends) at a
// different x-position depending on how long its own label is. Drawing the label and the
// underscores as two separate calls, at fixed x-offsets, keeps every blank line aligned.
const SIGNATURE_LABEL_WIDTH = 90;
const SIGNATURE_UNDERLINE = '_'.repeat(28);

function signatureLine(x, sigY, label) {
    page2.text(x, sigY, 9, label);
    page2.text(x + SIGNATURE_LABEL_WIDTH, sigY, 9, SIGNATURE_UNDERLINE);
}

y -= 30;
[LEGAL_TEMPLATE.vendorName, clientLegalName].forEach((party, i) => {
    const x = 72 + i * 260;
    let sigY = y;
    page2.boldText(x, sigY, 10, party);
    sigY -= 20;
    signatureLine(x, sigY, 'Signature:');
    sigY -= 20;
    signatureLine(x, sigY, 'Printed Name:');
    sigY -= 20;
    signatureLine(x, sigY, 'Title:');
    sigY -= 20;
    signatureLine(x, sigY, 'Date:');
});

const pdfBytes = buildPdfBytes([page1.build(), page2.build()], {
    data: fromBase64(LOGO_JPEG_BASE64),
    width: LOGO_PIXEL_WIDTH,
    height: LOGO_PIXEL_HEIGHT,
});
const base64Pdf = toBase64(pdfBytes);

// Create a new MAF record, or update the existing one's period fields in place - either
// way, regenerating resets Status to "Generated" (a fresh PDF invalidates any prior sign-off
// on the previous version) and refreshes Months Applied to the current period's months -
// an update can cover a different period than before, so the old links would otherwise go
// stale and misreport which months this MAF actually covers.
const now = new Date().toISOString();
const monthsAppliedLinks = [...monthsAppliedIds].map(id => ({id}));
let mafRecordId = existingMafRecordId;
if (mafRecordId) {
    await mafTable.updateRecordAsync(mafRecordId, {
        [MAF_FIELDS.periodLabel]: periodLabel,
        [MAF_FIELDS.periodStart]: periodStart,
        [MAF_FIELDS.periodEnd]: periodEnd,
        [MAF_FIELDS.status]: {name: 'Generated'}, // singleSelect fields need {name: ...}, not a bare string, in the classic Scripting API
        [MAF_FIELDS.lastGeneratedAt]: now,
        [MAF_FIELDS.monthsApplied]: monthsAppliedLinks,
    });
} else {
    mafRecordId = await mafTable.createRecordAsync({
        [MAF_FIELDS.periodLabel]: periodLabel,
        [MAF_FIELDS.campaign]: [{id: campaignRecordId}],
        [MAF_FIELDS.periodStart]: periodStart,
        [MAF_FIELDS.periodEnd]: periodEnd,
        [MAF_FIELDS.status]: {name: 'Generated'}, // singleSelect fields need {name: ...}, not a bare string, in the classic Scripting API
        [MAF_FIELDS.monthsApplied]: monthsAppliedLinks,
        [MAF_FIELDS.lastGeneratedAt]: now,
    });
}

// PDF is a multi-attachment field - uploadAttachment always ADDS a new attachment rather
// than replacing, so every run keeps prior copies as version history. Each upload gets a
// timestamped filename so versions stay distinguishable in the attachment list (title +
// periodLabel alone would collide on every regeneration of the same record).
// content.airtable.com, NOT api.airtable.com - this endpoint lives on a different
// subdomain than every other Airtable REST call.
const versionStamp = now.replace(/[:.]/g, '-');
const uploadUrl = `https://content.airtable.com/v0/${base.id}/${mafRecordId}/${MAF_FIELDS.pdf}/uploadAttachment`;
const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${input.secret('airtablePat')}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        contentType: 'application/pdf',
        filename: `MAF-${title}-${periodLabel}-${versionStamp}.pdf`,
        file: base64Pdf,
    }),
});

const responseBody = await response.text();
if (!response.ok) {
    throw new Error(`Attachment upload failed (${response.status}): ${responseBody}`);
}
output.set('mafRecordId', mafRecordId);
output.set('uploadResult', responseBody);
