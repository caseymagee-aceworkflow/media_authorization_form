import {useState} from 'react';
import {GENERATE_ATTACHMENT_WEBHOOK_URL} from '../lib/constants';

// Triggers the "PDF Generator" automation via its webhook trigger - a plain, hand-written
// PDF (no styling, unsigned) gets uploaded onto a MAF record (created new, or updated in
// place when existingMafRecordId is set).
//
// hooks.airtable.com sends no CORS headers at all, and confirmed (via curl, bypassing the
// browser entirely) that it rejects anything other than application/json or
// application/x-www-form-urlencoded Content-Type. Since application/x-www-form-urlencoded
// is also one of the three CORS-safelisted content types, using it satisfies both
// constraints: no preflight (the endpoint has none to pass), and Airtable accepts the body.
// mode: 'no-cors' makes this fire-and-forget - a resolved fetch means the request was sent,
// not that the automation succeeded. Only an actual network failure (caught below) is
// something we can detect from here.
// columnFieldIds is passed through so the generated PDF's line-items table matches
// whatever's currently configured in the properties panel - Automations can't read this
// element's own configuration (useCustomProperties is scoped to the Interface element,
// not queryable from a script), so the only way to keep them in sync is to send the
// current selection along with the trigger, at the moment the button is clicked. periodLabel/
// periodStart/periodEnd are similarly sent fresh each click rather than re-derived
// server-side, since they depend on this element's own fiscal-quarter picker state.
export default function SaveToRecordButton({
    campaignRecordId,
    columnFieldIds,
    periodLabel,
    periodStart,
    periodEnd,
    existingMafRecordId,
    onSaved,
}) {
    const [status, setStatus] = useState('idle'); // idle | saving | sent | error
    const hasPeriod = Boolean(periodLabel && periodStart && periodEnd);

    async function handleClick() {
        if (!hasPeriod) return;
        setStatus('saving');
        try {
            await fetch(GENERATE_ATTACHMENT_WEBHOOK_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: new URLSearchParams({
                    recordId: campaignRecordId,
                    columnFieldIds: columnFieldIds.join(','),
                    periodLabel,
                    periodStart,
                    periodEnd,
                    existingMafRecordId: existingMafRecordId || '',
                }),
            });
            setStatus('sent');
            onSaved?.();
        } catch {
            setStatus('error');
        }
    }

    const labels = {
        idle: existingMafRecordId ? 'Update MAF' : 'Save New MAF',
        saving: 'Saving…',
        sent: 'Sent - check record',
        error: 'Save failed - retry',
    };

    return (
        <button
            className="no-print px-4 py-2 text-sm font-semibold rounded bg-blue-blue text-white hover:opacity-90 disabled:opacity-50"
            onClick={handleClick}
            disabled={status === 'saving' || !hasPeriod}
            title={hasPeriod ? undefined : 'Select a time period first'}
        >
            {labels[status]}
        </button>
    );
}
