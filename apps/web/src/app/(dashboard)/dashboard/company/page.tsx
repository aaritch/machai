import type { Metadata } from 'next';
import { eq, getDb, representatives } from '@machai/db';
import { ENTITY_TYPE_LABELS, formatPhone } from '@machai/types';
import { Alert, Badge, Card, CardBody, CardHeader, LinkButton } from '@machai/ui';
import { CompanyForm } from '@/components/dashboard/company-form';
import { getAccountContext } from '@/server/context';
import { requireBusinessOwnership } from '@/server/auth/guards';

export const metadata: Metadata = { title: 'Company info' };

/** Company Info (spec §7.6). */
export default async function CompanyPage() {
  const context = await getAccountContext();
  if (!context) return null;

  if (!context.businessId) {
    return (
      <Card>
        <CardBody className="p-8 text-center">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
            No business on file
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Complete signup to add your business details.
          </p>
          <LinkButton href="/signup" className="mt-5">
            Add your business
          </LinkButton>
        </CardBody>
      </Card>
    );
  }

  const business = await requireBusinessOwnership(context.user, context.businessId);
  const [rep] = await getDb()
    .select()
    .from(representatives)
    .where(eq(representatives.businessId, business.id))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Company info
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Bureaus match your file against these details, so accuracy matters.
        </p>
      </div>

      {business.verificationStatus === 'pending' ? (
        <Alert tone="info" title="Verification in progress">
          {business.verificationNotes ?? 'Your business is being verified.'}
        </Alert>
      ) : business.verificationStatus === 'rejected' ? (
        <Alert tone="danger" title="We could not verify this business">
          {business.verificationNotes ?? 'Please check the details below.'} If you believe this is
          wrong, contact support and we will look at it by hand.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Tax ID"
          description="Encrypted at rest and never shown in full again."
          action={
            <Badge tone={business.verificationStatus === 'verified' ? 'success' : 'warning'}>
              {business.verificationStatus}
            </Badge>
          }
        />
        <CardBody>
          <p className="font-mono text-lg tabular-nums text-neutral-900 dark:text-neutral-100">
            ••-•••{business.einLast4}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Your EIN cannot be changed here. If it was entered incorrectly, contact support — we
            re-verify the business whenever it changes.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Business details"
          description="Changing the legal name or entity type triggers re-verification."
        />
        <CardBody>
          <CompanyForm
            defaults={{
              legalName: business.legalName,
              dbaName: business.dbaName ?? '',
              streetAddress: business.streetAddress,
              addressLine2: business.addressLine2 ?? '',
              city: business.city,
              state: business.state,
              zip: business.zip,
              phone: business.phone,
              entityType: business.entityType,
              website: business.website ?? '',
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Authorized representative" />
        <CardBody>
          {rep ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Name" value={`${rep.firstName} ${rep.lastName}`} />
              <Detail label="Title" value={rep.title} />
              <Detail label="Email" value={rep.email} />
              <Detail label="Phone" value={rep.phone ? formatPhone(rep.phone) : '—'} />
              <Detail label="Ownership" value={`${Number(rep.ownershipPercentage)}%`} />
              <Detail
                label="Entity type"
                value={ENTITY_TYPE_LABELS[business.entityType] ?? business.entityType}
              />
            </dl>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No representative on file.
            </p>
          )}
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            To change the representative, contact support — the attestation needs to be re-made.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  );
}
