import type { Metadata } from 'next';
import { asc, eq, getDb, products } from '@machai/db';
import { formatPrice } from '@machai/config';
import { Card, CardBody, CardHeader, EmptyState } from '@machai/ui';
import { BuyProductButton } from '@/components/dashboard/product-buttons';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Products' };

/** One-off products (spec §4.15, §7.6). Separate from the subscription. */
export default async function ProductsPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const rows = await getDb()
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(asc(products.displayOrder));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Products
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          One-off purchases, separate from your subscription.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No products available yet" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((product) => (
            <Card key={product.id}>
              <CardHeader
                title={product.title}
                description={formatPrice(product.priceCents, product.currency)}
              />
              <CardBody className="space-y-4">
                <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {product.description}
                </p>
                <BuyProductButton
                  productId={product.id}
                  disabled={!context.user.emailVerifiedAt}
                />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
