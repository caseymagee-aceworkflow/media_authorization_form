// ACE Demo Base (appJ0nLzqh0oodsRQ)
// "Campaign" replaces the old "Campaign Info" table; "Media Plan" (singular, a rebuilt
// table with a different schema) replaces the old "Media Plans". Quarter-specific tracking
// was dropped in favor of aggregate rollup amounts - see project decisions.
export const CAMPAIGN_TABLE_ID = 'tblApzXRiH8nTBPtU';
export const MEDIA_PLAN_TABLE_ID = 'tblHy85L1pZBxioOT';

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

// Fiscal Year only lives on Campaign, which isn't reachable from this single-table build -
// every sampled record was FY27, so that's used as a fallback display value until
// multi-table access is restored and this can read the real field.
export const FALLBACK_FISCAL_LABEL = 'FY27';

// Fires the "Generate MAF Attachment" automation (webhook trigger, since button-field
// triggers can't be invoked from an Interface button - only from a native Interface
// button element, which doesn't apply to a custom extension's own button). The webhook
// can only trigger this one automation - not general API access - so it's fine to keep
// as a plain constant here even though the extension's code ships to every viewer.
export const GENERATE_ATTACHMENT_WEBHOOK_URL =
    'https://hooks.airtable.com/workflows/v1/genericWebhook/appJ0nLzqh0oodsRQ/wfl6lCrUcjhkZ7CLg/wtr4rzMg45YNJi4RQ';
