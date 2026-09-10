// Template for webhookConfig.local.js, which is gitignored and holds the real webhook URL
// (kept out of source control - see the "Is this safe to make public?" discussion in the
// project history for why: this URL is effectively an unauthenticated bearer credential for
// the "PDF Generator" automation, with no protection beyond the automation/trigger IDs being
// unguessable).
//
// To build/run this extension locally: copy this file to webhookConfig.local.js in this
// same directory, and replace the placeholder below with the real URL (find it in the
// "PDF Generator" automation's webhook trigger step in Airtable, or ask a teammate who
// already has it).
export const GENERATE_ATTACHMENT_WEBHOOK_URL =
    'https://hooks.airtable.com/workflows/v1/genericWebhook/YOUR_BASE_ID/YOUR_AUTOMATION_ID/YOUR_TRIGGER_ID';
