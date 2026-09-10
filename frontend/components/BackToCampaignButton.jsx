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
export default function BackToCampaignButton({campaignId}) {
    const href = `https://airtable.com/appJ0nLzqh0oodsRQ/pagm5r5idgH32XZZy/${campaignId}?home=pag9Z3G4YnxaSiii2`;
    return (
        <a
            href={href}
            className="no-print px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50 dark:text-gray-gray200 dark:border-gray-gray600 dark:hover:bg-gray-gray800 inline-block"
        >
            ← Back to Campaign
        </a>
    );
}
