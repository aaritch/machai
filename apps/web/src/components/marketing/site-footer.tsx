import Link from 'next/link';
import { brand, disclosures } from '@machai/config/public';
import { LogoLockup } from '@/components/brand/logo';

/**
 * Footer (spec §5.1).
 *
 * `availabilityLine` and `roadmapLine` are passed in from the server, resolved
 * through the config gate — never written inline. That is the mechanism that
 * stops a bureau claim shipping ahead of its furnisher approval.
 */
export function SiteFooter({
  availabilityLine,
  roadmapLine,
  reportingClaim,
}: {
  availabilityLine: string;
  roadmapLine: string | null;
  reportingClaim: string | null;
}) {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <LogoLockup markClassName="h-6" wordClassName="text-base" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-400">{brand.tagline}</p>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { href: '/pricing', label: 'Pricing' },
              { href: '/learn', label: 'About business credit' },
              { href: '/help', label: 'Help center' },
              { href: '/signup', label: 'Create an account' },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { href: '/about', label: 'About' },
              { href: '/contact', label: 'Contact' },
              { href: '/help', label: 'Support' },
            ]}
          />
          <FooterColumn
            title="Legal"
            links={[
              { href: '/legal/terms', label: 'Terms of Service' },
              { href: '/legal/privacy', label: 'Privacy Policy' },
            ]}
          />
        </div>

        <div className="mt-10 space-y-2 border-t border-neutral-800 pt-6 text-xs leading-relaxed text-neutral-500">
          <p>{availabilityLine}</p>
          {reportingClaim ? <p>{reportingClaim}</p> : null}
          {roadmapLine ? <p>{roadmapLine}</p> : null}
          <p>{disclosures.noGuarantee}</p>
          <p className="pt-2">
            © {new Date().getFullYear()} {brand.name}. Not a credit repair organization. We do not
            offer to remove accurate information from any credit file.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="text-sm text-neutral-400 transition-colors hover:text-accent-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
