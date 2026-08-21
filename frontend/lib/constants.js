// ACE Demo Base (appJ0nLzqh0oodsRQ)
// "Campaign" replaces the old "Campaign Info" table; "Media Plan" (singular, a rebuilt
// table with a different schema) replaces the old "Media Plans". Quarter-specific tracking
// was dropped in favor of aggregate rollup amounts - see project decisions.
export const CAMPAIGN_TABLE_ID = 'tblApzXRiH8nTBPtU';
export const MEDIA_PLAN_TABLE_ID = 'tblHy85L1pZBxioOT';
// Monthly Plan (aka "Monthly Budget Lines" in the base UI) - one row per calendar month
// within a Media Plan's flight. Needs to be added as a SECOND connected table on this
// Interface Extension element in Designer (multi-table/"AI Labs") before these fields are
// actually readable - see the period-filtering work in App.jsx.
export const MONTHLY_PLAN_TABLE_ID = 'tblAExLLgHy1XAkE3';

export const CAMPAIGN_FIELDS = {
    campaignName: 'fldwfSiX6f8B7MXGr', // primary field, used as document title
    fiscalYear: 'fldTiznICd5dHZDsU', // single-linked-record field (to a Fiscal Year table)
    mediaPlans: 'fldDh02dbQtnUKtwc', // link to line items
    todaysDate: 'fldW4bq4AEkxjAi8J',
    currentAdjustedBudget: 'fld0Q6Smwdi1Vtj95',
    totalCommission: 'fldWaZqYIqXzeHSes',
    client: 'fldyGTEvcfdtAwLWy', // link to the Client table
};

export const MEDIA_PLAN_FIELDS = {
    site: 'fldgWoTC09fphswbx', // primary field
    country: 'fldDntdz6zs6SYV24',
    packageTactic: 'fldqLXuxHXKJ9gMvQ',
    flightStart: 'fldB2cmo3XmVX2nM5',
    flightEnd: 'fldWaLcSFgHKXGE0a',
    // Link back to Campaign - used so the extension can group/aggregate by campaign using
    // only the Media Plan table it currently has access to (this custom element is
    // currently restricted to a single connected table).
    campaign: 'flduT6XLi5MrNzm8W',
    // Row-level rollups matching exactly what Campaign's own rollups sum from (verified via
    // get_table_schema) - summing these across a campaign's linked rows reproduces the same
    // totals Campaign's rollups would show, without needing direct Campaign table access.
    currentAdjustedBudget: 'fldmvjNGReswjPhKZ',
    totalCommission: 'fldGYhiz2WJTLD6lM',
    // Lookup through the Campaign link, targeting Campaign's own Client field (verified via
    // get_table_schema) - gives the real client name without needing direct Campaign access.
    client: 'fldbTNRt2uuB1gbzN',
    // Already existed on Media Plan (a lookup through Campaign -> Client) - the month this
    // row's client's fiscal year starts in (1-12). Drives the fiscal-quarter math in
    // lib/fiscalPeriods.js; every client sampled so far is January, but the schema is
    // fiscal-aware per client, so this isn't hardcoded.
    fiscalYearStartDate: 'fldjIohJNwZAu3iNB',
    // Lookup through the Campaign link, of Campaign's own "MAF Records" reverse-link field
    // (auto-created when the MAF table's Campaign link field was made) - every MAF record
    // already generated for this row's campaign, as {id, name=Period Label} pairs. Powers
    // the "update an existing MAF" picker.
    mafRecords: 'fldt6hkLKMMqtdAwt',
    // Index-aligned with mafRecords (Airtable preserves lookup ordering across multiple
    // lookups sourced from the same link field) - lets the update picker pre-fill the period
    // picker from whichever existing MAF record was selected.
    mafPeriodStarts: 'fldRplSDrDmJftBhY',
    mafPeriodEnds: 'fldGLI7SXmhZuzO14',
};

// Monthly Plan fields needed for period filtering/prorating - see MONTHLY_PLAN_TABLE_ID.
export const MONTHLY_PLAN_FIELDS = {
    mediaPlan: 'fldQ9Hf1mL3WH7tFf', // link back to Media Plan
    recordOrder: 'flddFUxLmoSCywuzl', // formula, "YYYY-MM", zero-padded and string-sortable
    // Both already-computed per-month formula fields that Media Plan's own full-flight
    // rollups (Current Adjusted Budget / Total Commission) sum across ALL of a plan's
    // months (verified via get_table_schema) - prorating to a period means summing just
    // these two fields for the months that fall inside it, not reimplementing the
    // budget/commission business logic client-side.
    adjustedBudget: 'fldmtBBITSyiUdK7R',
    commission: 'fldMlfsA8n1M9IqX8',
};

// clientLegalName is no longer used as the primary source (the real Client record's name is
// read dynamically instead - see App.jsx/generate-maf-attachment.js) but stays as a fallback
// for a campaign with no linked Client record.
export const LEGAL_TEMPLATE = {
    clientLegalName: 'the Client',
    vendorName: 'Media.Monks',
    billingEntity: 'Decoded Advertising',
    workStatementDate: 'April 18th, 2024',
};

// Shown in place of a real period label only before the viewer has picked a period (see
// PeriodPicker.jsx/App.jsx) - once a period is selected, the document's fiscalLabel becomes
// the real formatPeriodLabel() output instead.
export const FALLBACK_FISCAL_LABEL = 'FY27';

// Fires the "Generate MAF Attachment" automation (webhook trigger, since button-field
// triggers can't be invoked from an Interface button - only from a native Interface
// button element, which doesn't apply to a custom extension's own button). The webhook
// can only trigger this one automation - not general API access - so it's fine to keep
// as a plain constant here even though the extension's code ships to every viewer.
export const GENERATE_ATTACHMENT_WEBHOOK_URL =
    'https://hooks.airtable.com/workflows/v1/genericWebhook/appJ0nLzqh0oodsRQ/wfl6lCrUcjhkZ7CLg/wtr4rzMg45YNJi4RQ';
