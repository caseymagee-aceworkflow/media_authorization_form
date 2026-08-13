import {LEGAL_TEMPLATE} from '../lib/constants';

function SignatureBlock({party}) {
    return (
        <div className="flex-1">
            <div className="font-semibold text-sm mb-4">{party}</div>
            <div className="text-xs space-y-4">
                <div>
                    By: <span className="inline-block border-b border-gray-gray700 w-48 h-4 align-bottom" />
                </div>
                <div>
                    Printed Name: <span className="inline-block border-b border-gray-gray700 w-40 h-4 align-bottom" />
                </div>
                <div>
                    Title: <span className="inline-block border-b border-gray-gray700 w-48 h-4 align-bottom" />
                </div>
                <div>
                    Date: <span className="inline-block border-b border-gray-gray700 w-40 h-4 align-bottom" />
                </div>
            </div>
        </div>
    );
}

export default function LegalPage({data}) {
    // Client name is now read dynamically from the record (see App.jsx) - vendor/billing
    // entity/work statement date remain static template values.
    const {vendorName, billingEntity, workStatementDate} = LEGAL_TEMPLATE;
    const clientLegalName = data.clientLegalName;

    return (
        <div className="maf-page bg-white p-10">
            <p className="text-sm font-semibold uppercase mb-4">
                {clientLegalName.toUpperCase()} ISSUES APPROVAL TO {vendorName.toUpperCase()} TO PURCHASE THE FOLLOWING:
            </p>

            <p className="text-xs text-gray-gray700 leading-relaxed">
                For purposes of clarification, invoices will be payable to {billingEntity}, solely for amounts
                actually and verifiably spent, regardless of the total budget provided for herein. Invoices shall
                be payable net 30 days. This Media Authorization Form (&quot;MAF&quot;) shall not be effective
                until such time as it has been signed by both parties and returned. The parties hereby acknowledge
                that this MAF, along with the Work Statement effective {workStatementDate} and the Advertising
                Services Agreement (the &quot;Agreement&quot;) between {clientLegalName} and {vendorName} represent
                the entire agreement of the parties with respect to the services set forth herein and the parties
                acknowledge their agreement by a valid signature from an authorized representative. No changes to
                this MAF will be considered valid unless they have been made in writing executed by both parties.
                In the event of a conflict between the terms of this MAF and the Agreement, the terms of the
                Agreement shall govern. All investment listed on the MAF shall remain fluid across listed partners
                as need be for optimization purposes, so long as there is alignment from {clientLegalName}. Agency
                Fee is subject to the terms of SOW covering this time period.
            </p>

            <div className="flex gap-16 mt-10">
                <SignatureBlock party={vendorName} />
                <SignatureBlock party={clientLegalName} />
            </div>

            {/* TODO: confirm fine-print footer content with user - not clearly legible in the sample. */}
            <p className="mt-12 text-[8px] text-gray-gray400 leading-snug">
                Confidential — for use by the parties named above only.
            </p>
        </div>
    );
}
