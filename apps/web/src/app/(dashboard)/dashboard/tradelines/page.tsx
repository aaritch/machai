import type { Metadata } from 'next';
import { formatPrice } from '@machai/config';
import { and, desc, eq, getDb, isNull, tradelines } from '@machai/db';
import { BUREAU_LABELS } from '@machai/types';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState } from '@machai/ui';
import { AddTradelineForm, DeleteTradelineButton } from '@/components/dashboard/tradeline-forms';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Tradeline tracker' };

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  net30: 'Net-30',
  revolving: 'Revolving',
  installment: 'Installment',
  vendor: 'Vendor',
  other: 'Other',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  current: 'Current',
  late_30: '30 days late',
  late_60: '60 days late',
  late_90: '90+ days late',
  collections: 'In collections',
};

/** Tradeline Tracker (spec §7.3). */
export default async function TradelinesPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const rows = context.businessId
    ? await getDb()
        .select()
        .from(tradelines)
        .where(and(eq(tradelines.businessId, context.businessId), isNull(tradelines.deletedAt)))
        .orderBy(desc(tradelines.createdAt))
    : [];

  const notReporting = rows.filter((row) => row.reportedTo.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Tradeline tracker
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Log the accounts your business holds and track which bureaus each one appears on.
        </p>
      </div>

      {notReporting.length > 0 ? (
        <Alert tone="warning" title={`${notReporting.length} account${notReporting.length === 1 ? '' : 's'} not reporting`}>
          An account that does not report to any bureau does nothing for your file. It is worth
          asking the supplier which bureaus they report to — plenty do not report at all.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Your tradelines" description={`${rows.length} tracked`} />
        {rows.length === 0 ? (
          <EmptyState
            title="No tradelines tracked yet"
            description="Add the vendor accounts, cards, and loans your business holds so you can see which are reporting."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">Tradelines tracked for your business</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Creditor</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Type</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Balance</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Limit</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Reporting to</th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                    <td className="px-5 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {row.creditorName}
                    </td>
                    <td className="px-5 py-3 text-neutral-700 dark:text-neutral-300">
                      {ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.currentBalanceCents !== null ? formatPrice(row.currentBalanceCents) : '—'}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                      {row.creditLimitCents !== null ? formatPrice(row.creditLimitCents) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={row.paymentStatus === 'current' ? 'success' : 'danger'}>
                        {PAYMENT_STATUS_LABELS[row.paymentStatus] ?? row.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {row.reportedTo.length === 0 ? (
                        <Badge tone="warning">Not reporting</Badge>
                      ) : (
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {row.reportedTo.map((b) => BUREAU_LABELS[b]).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <DeleteTradelineButton id={row.id} name={row.creditorName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Add a tradeline" />
        <CardBody>
          <AddTradelineForm disabled={!context.businessId} />
        </CardBody>
      </Card>
    </div>
  );
}
