// Links straight to the Campaign record's detail page (pagm5r5idgH32XZZy) instead of
// replaying browser history - history.back() used to be the only option because a direct
// link to that page redirected to the interface root for anyone without edit access (it was
// still unpublished). It's since been published, but the real bug that forced fixing this:
// switching campaigns via RecordPicker's dropdown changes the URL (see App.jsx's
// useSearchParams sync) without leaving this page, so "Back" would walk through *those*
// history entries instead of actually leaving - i.e. it didn't reliably go "back to
// campaign" at all once you'd toggled between campaigns first.
// `home` points back at this element's own page (the "Generate MAF" page,
// pag9Z3G4YnxaSiii2 in the "Director Dashboard" interface) so Airtable's own back
// navigation from the detail view returns here, not wherever browser history happened to be.
//
// This custom element actually runs on a completely different origin than the parent
// Airtable app (an *.alt.airtableblocks.com sandbox, confirmed via a thrown
// SecurityError), not just a different same-origin frame - `<a target="_top">` and
// `window.top.location.assign(...)` both failed because reading/calling methods on a
// cross-origin frame's Location is blocked. A plain property ASSIGNMENT to `.href` is
// specifically carved out as allowed cross-origin (the standard way to navigate a parent
// frame from a sandboxed cross-origin iframe), so that's the one form that actually works.
export default function BackToCampaignButton({campaignId}) {
    const href = `https://airtable.com/appJ0nLzqh0oodsRQ/pagm5r5idgH32XZZy/${campaignId}?home=pag9Z3G4YnxaSiii2`;
    return (
        <button
            type="button"
            onClick={() => {
                window.top.location.href = href;
            }}
            className="no-print px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50 dark:text-gray-gray200 dark:border-gray-gray600 dark:hover:bg-gray-gray800"
        >
            ← Back to Campaign
        </button>
    );
}
