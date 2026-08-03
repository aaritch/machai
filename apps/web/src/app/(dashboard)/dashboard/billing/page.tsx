import type { Metadata } from 'next';
import { PRORATION_NOTE, formatPrice } from '@machai/config';
import { desc, eq, getDb, invoices } from '@machai/db';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, StatTile } from '@machai/ui';
import { BillingActions, PlanOptions } from '@/components/dashboard/billing-panels';
import { getAccountContext } from '@/server/context';
import { getActivePlans } from '@/server/plans';

export const metadata: Metadata = { title: 'Subscriptions & billing' };

/**
 * Subscriptions & Billing (spec §7.5, pic3/pic5).
 *
 * Every figure here comes from the MIRROR, never from a live Stripe call — the
 * request path must not depend on Stripe being reachable (TASK-04 security
 * scenario). The Refresh control is the explicit escape hatch when the mirror
 * has drifted.
 */
export default async function BillingPage() {
  const context = await getAccountContext();
  if (!context) return null;

  const [plans, invoiceRows] = await Promise.all([
    getActivePlans(),
    getDb()
      .select()
      .from(invoices)
      .where(eq(invoices.userId, context.user.id))
      .orderBy(desc(invoices.createdAt))
      .limit(50),
  ]);

  const paidInvoices = invoiceRows.filter((i) => i.status === 'paid');
  const lifetimePaidCents = paidInvoices.reduce((sum, i) => sum + i.amountPaidCents, 0);
  const isActive = context.subscription.status === 'active' || context.subscription.status === 'trialing';

  const daysRemaining = context.subscription.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil(
          (context.subscription.currentPeriodEnd.getTime() - Date.now()) / (24 * 3600 * 1000),
        ),
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Subscriptions &amp; billing
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Your plan, payment method, and invoice history.
          </p>
        </div>
        <BillingActions hasCustomer={Boolean(context.subscription.status)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Plan price"
          value={
            context.subscription.monthlyPriceCents
              ? `${formatPrice(context.subscription.monthlyPriceCents)}/mo`
              : '—'
          }
          hint={context.subscription.planName ?? 'No plan selected'}
        />
        <StatTile label="Total paid" value={formatPrice(lifetimePaidCents)} hint="Lifetime" />
        <StatTile label="Paid invoices" value={paidInvoices.length} />
        <StatTile
          label="Status"
          value={isActive ? 'Active' : context.inGracePeriod ? 'Past due' : 'Inactive'}
          tone={isActive ? 'accent' : 'neutral'}
        />
        <StatTile
          label="Period ends"
          value={
            context.subscription.currentPeriodEnd
              ? context.subscription.currentPeriodEnd.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'
          }
        />
        <StatTile label="Days remaining" value={daysRemaining ?? '—'} />
      </div>

      {!context.subscription.status ? (
        <Alert tone="info" title="No active subscription">
          Choose a plan below to activate business credit monitoring.
        </Alert>
      ) : null}

      {context.subscription.cancelAtPeriodEnd ? (
        <Alert tone="warning" title="Your plan is set to cancel">
          You keep access until{' '}
          {context.subscription.currentPeriodEnd?.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          . You can reactivate any time before then.
        </Alert>
      ) : null}

      {/* Payment method */}
      <Card>
        <CardHeader title="Payment method" description="Card details are held by Stripe, never by us." />
        <CardBody>
          {context.subscription.cardLast4 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-800 dark:text-neutral-200">
                <span className="font-medium capitalize">{context.subscription.cardBrand}</span>{' '}
                ending in {context.subscription.cardLast4}
              </p>
              <Badge tone="success">On file</Badge>
            </div>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No payment method on file. Add one when you subscribe, or through the billing portal.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Plan options */}
      <Card>
        <CardHeader title="Plan options" description={PRORATION_NOTE} />
        <CardBody>
          <PlanOptions
            plans={plans.map((p) => ({
              code: p.code,
              name: p.name,
              tagline: p.tagline,
              priceLabel: `${formatPrice(p.monthlyPriceCents, p.currency)}/mo`,
              isContactSales: p.isContactSales,
              isCurrent: p.code === context.subscription.planCode,
            }))}
            emailVerified={Boolean(context.user.emailVerifiedAt)}
          />
        </CardBody>
      </Card>

      {/* Billing history */}
      <Card>
        <CardHeader title="Billing history" />
        {invoiceRows.length === 0 ? (
          <EmptyState
            title="No invoices are available yet"
            description="Invoices appear here after your first payment."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Your invoices</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Date</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Amount</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Status</th>
                  <th scope="col" className="px-5 py-3 font-medium text-neutral-500">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                    <td className="px-5 py-3 text-neutral-800 dark:text-neutral-200">
                      {(invoice.paidAt ?? invoice.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-800 dark:text-neutral-200">
                      {formatPrice(invoice.amountPaidCents || invoice.amountDueCents, invoice.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        tone={
                          invoice.status === 'paid'
                            ? 'success'
                            : invoice.status === 'open'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {invoice.invoicePdfUrl ? (
                        <a
                          href={invoice.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-accent-700 hover:underline dark:text-accent-300"
                        >
                          PDF
                        </a>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
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
