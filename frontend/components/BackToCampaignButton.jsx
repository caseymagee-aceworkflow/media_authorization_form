// A reconstructed deep link to the Campaign detail page (pagm5r5idgH32XZZy) doesn't work -
// that page is still unpublished, so Airtable redirects any direct link to it back to the
// interface's root instead of the record. Real browser history doesn't have that problem,
// since the viewer's tab already has the originating page as a genuine prior entry - this
// button just replays that instead of trying to rebuild the URL.
export default function BackToCampaignButton() {
    return (
        <button
            className="no-print px-4 py-2 text-sm font-semibold rounded border border-gray-gray300 text-gray-gray700 hover:bg-gray-gray50 dark:text-gray-gray200 dark:border-gray-gray600 dark:hover:bg-gray-gray800"
            onClick={() => window.history.back()}
        >
            ← Back to Campaign
        </button>
    );
}
