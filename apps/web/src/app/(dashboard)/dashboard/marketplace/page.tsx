import type { Metadata } from 'next';
import { asc, eq, getDb, marketplaceItems } from '@machai/db';
import { canAccessMarketplaceItem } from '@machai/entitlements';
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton } from '@machai/ui';
import { getAccountContext } from '@/server/context';

export const metadata: Metadata = { title: 'Marketplace' };

const TYPE_LABELS: Record<string, string> = {
  course: 'Course',
  vendor: 'Vendor list',
  resource: 'Resource',
  product: 'Product',
};

/**
 * Marketplace (spec §7.6).
 *
 * Locked items are shown rather than hidden — an upsell only works if the user
 * can see what they are missing. Access to the CONTENT is enforced server-side
 * when it is requested; hiding an item in the UI is not access control
 * (TASK-07 caveat).
 */
export default async function MarketplacePage() {
  const context = await getAccountContext();
  if (!context) return null;

  const items = await getDb()
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.isActive, true))
    .orderBy(asc(marketplaceItems.displayOrder));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Marketplace
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Courses, vendor lists, and resources. What is unlocked depends on your plan.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing here yet"
            description="Marketplace content is being prepared. Check back shortly."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const unlocked = canAccessMarketplaceItem(context.entitlements, item.accessLevel);
            return (
              <Card key={item.id}>
                <CardHeader
                  title={item.title}
                  description={TYPE_LABELS[item.type] ?? item.type}
                  action={
                    unlocked ? (
                      <Badge tone="success">Unlocked</Badge>
                    ) : (
                      <Badge tone="neutral">Locked</Badge>
                    )
                  }
                />
                <CardBody className="space-y-4">
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {item.description}
                  </p>
                  {unlocked ? (
                    <LinkButton href="/dashboard/marketplace" size="sm" variant="secondary">
                      Open
                    </LinkButton>
                  ) : (
                    <LinkButton href="/dashboard/billing" size="sm">
                      Upgrade to unlock
                    </LinkButton>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
