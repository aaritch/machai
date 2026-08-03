import type { Metadata } from 'next';
import { desc, eq, getDb, products, purchases } from '@machai/db';
import { formatPrice } from '@machai/config';
import { Badge, Card, CardHeader, EmptyState } from '@machai/ui';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'My purchases' };

export default async function PurchasesPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const rows = await getDb()
    .select({
      id: purchases.id,
      amountCents: purchases.amountCents,
      currency: purchases.currency,
      status: purchases.status,
      purchasedAt: purchases.purchasedAt,
      createdAt: purchases.createdAt,
      title: products.title,
    })
    .from(purchases)
    .leftJoin(products, eq(products.id, purchases.productId))
    .where(eq(purchases.userId, context.user.id))
    .orderBy(desc(purchases.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        My purchases
      </h1>

      <Card>
        <CardHeader title="Purchase history" description={`${rows.length} total`} />
        {rows.length === 0 ? (
          <EmptyState
            title="No purchases yet"
            description="One-off products you buy appear here alongside their receipts."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">Your one-off purchases</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Item</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Date</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Amount</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                    <td className="px-5 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {row.title ?? 'Product'}
                    </td>
                    <td className="px-5 py-3 text-neutral-700 dark:text-neutral-300">
                      {(row.purchasedAt ?? row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                      {formatPrice(row.amountCents, row.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={row.status === 'paid' ? 'success' : 'neutral'}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
