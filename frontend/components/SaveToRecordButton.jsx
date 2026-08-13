import {useState} from 'react';
import {GENERATE_ATTACHMENT_WEBHOOK_URL} from '../lib/constants';

// Triggers the "Generate MAF Attachment" automation via its webhook trigger - a plain,
// hand-written PDF (no styling, unsigned) gets uploaded to the record's attachment field
// as an audit-trail copy. This is deliberately not the polished document (see PrintButton) -
// see lib/constants.js for why that tradeoff was chosen.
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
// current selection along with the trigger, at the moment the button is clicked.
export default function SaveToRecordButton({campaignRecordId, columnFieldIds}) {
    const [status, setStatus] = useState('idle'); // idle | saving | sent | error

    async function handleClick() {
        setStatus('saving');
        try {
            await fetch(GENERATE_ATTACHMENT_WEBHOOK_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: new URLSearchParams({recordId: campaignRecordId, columnFieldIds: columnFieldIds.join(',')}),
            });
            setStatus('sent');
        } catch {
            setStatus('error');
        }
    }

    const labels = {
        idle: 'Save to Record',
        saving: 'Saving…',
        sent: 'Sent - check record',
        error: 'Save failed - retry',
    };

    return (
        <button
            className="no-print px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50 disabled:opacity-50"
            onClick={handleClick}
            disabled={status === 'saving'}
        >
            {labels[status]}
        </button>
    );
}
