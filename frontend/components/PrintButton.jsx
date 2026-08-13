// No PDF library involved - the browser's own print dialog ("Save as PDF") is the generator.
// Pagination between the two document pages is handled entirely by the @page/break-after
// CSS rules in style.css.
export default function PrintButton() {
    return (
        <button
            className="no-print px-4 py-2 text-sm font-semibold rounded bg-blue-blue text-white hover:opacity-90"
            onClick={() => window.print()}
        >
            Generate PDF
        </button>
    );
}
