# TASK-03 — Marketing site & help center

**Phase:** 1 · **Owner:** Frontend + Product/Design · **Depends on:** TASK-01 · **Consulted:** Legal (claims)

## Objective

Build the public, SEO-rendered site — home, pricing, contact, help center, about/education, legal — that converts visitors into free accounts and communicates the product truthfully. The contact form must create a real support ticket.

## Scope

**In:** global nav/footer, home page (with "3 easy steps" and the bureau strip), pricing page, contact page + form→ticket, help center (searchable articles + FAQs), about/company + educational pillar page, Terms/Privacy pages, spam protection.
**Out:** the authenticated dashboard, actual checkout (TASK-04), ticket agent view (TASK-07). Pricing CTAs link to signup/checkout entry points owned by other tasks.

## Implementation details

**Rendering.** Server-rendered/statically generated for SEO and speed on Vercel. Clean, card-based layout, generous whitespace, single accent color. Sticky top nav: Company (dropdown), Learn (dropdown), Pricing, Log in (text), Sign up (button). Footer: Terms, Privacy, Contact, social, and a "Bureaus available with a plan" line driven by config.

**Home page sections.** Hero with core promise + primary CTA ("Create your free account — no card required"); "Build business credit in 3 easy steps" band (create EIN-only account → choose a plan & connect a bureau → get monitored/reported monthly); bureau strip (Creditsafe, Equifax Business, and roadmap bureaus) with honest qualifier copy; feature highlights; plan teaser (three cards); FAQ teaser; final CTA.

**Pricing page.** Three plan cards (Starter/Professional/Enterprise) with price, tagline, feature checklist, and CTAs: Starter/Professional → "Subscribe" (into checkout), Enterprise → "Contact Sales" (lead form). A detailed comparison table below. Plan data comes from the local `plans` table so marketing doesn't depend on a live Stripe call. Optional monthly/annual toggle.

**Contact page.** Two columns. Left: heading, supporting copy, and info blocks — Email, Response time, Hours, Support scope, and a "What happens after you send this" explainer. Right: message form (first name, last name, email, phone optional, message) → creates a `support_ticket` and sends an autoresponder. Protect with CAPTCHA + honeypot + rate limiting.

**Help center.** Searchable knowledge base backed by `help_articles` and `faqs`. Search box, category tiles (Getting started, Billing, Credit reporting, Account access, Disputes), popular articles, and a "Still need help? Contact us / Open a ticket" CTA. Content is CMS/db-managed so non-engineers can edit.

**About / education.** Company story + an educational pillar page ("what is business credit," how it differs from personal, what the bureaus are, why EIN-based credit matters). These are SEO assets — treat as CMS-managed content.

**Claims accuracy.** Every "reports to X bureau" statement is driven by a per-bureau `reporting_live` config flag. No claim renders unless the flag is on. Avoid implying guaranteed score increases.

## Data touched

`plans` (read), `faqs`, `help_articles`, `support_tickets` + `ticket_messages` (create from contact form), marketing-consent flag on signup.

## Test scenarios

**Happy path**
- Given a visitor on the home page, when they click the primary CTA, then they reach signup.
- Given the pricing page, when it loads, then three plans render from the `plans` table with correct prices and CTAs (Subscribe vs Contact Sales).
- Given a completed contact form, when submitted, then a support ticket is created and an autoresponder email is sent.
- Given a help-center search query, when submitted, then matching articles/FAQs are returned.

**Edge**
- Given a plan marked inactive, when pricing loads, then it does not appear.
- Given a bureau with `reporting_live=false`, when the bureau strip renders, then that bureau is shown only as roadmap (or hidden), never as an active reporting claim.
- Given a very long message in the contact form, when submitted, then it is accepted up to the documented limit and rejected beyond it with a clear message.

**Failure**
- Given the email provider is down, when a contact form is submitted, then the ticket is still created and the autoresponder is queued for retry (submission never silently lost).
- Given a search with no results, when run, then a helpful empty state with a contact CTA is shown.

**Security**
- Given a bot submitting the contact form, when the honeypot/CAPTCHA triggers, then the submission is rejected without creating a ticket.
- Given rapid repeated submissions, when the rate limit is hit, then further submissions are throttled.
- Given attempted script injection in a form field, when rendered later in the agent view, then output is encoded (no stored XSS).

## Caveats

- **Truthful claims are a legal matter, not a copy choice.** Do not name a bureau as "reports to" until an approved furnisher agreement exists (see TASK-06). Route claim wording through Legal. The `reporting_live` flag exists to enforce this in code.
- **No guarantees.** Avoid "guaranteed" score increases or funding — this language attracts regulatory scrutiny.
- **Contact form is a spam magnet.** Without CAPTCHA + honeypot + rate limiting it will fill your ticket queue with junk.
- **CMS content ownership.** Decide early whether marketing/help content is db-managed or via a headless CMS; retrofitting is costly.
- **SEO regressions.** Because these pages drive acquisition, guard against client-only rendering of key content and monitor Core Web Vitals.

## Definition of done

All public pages render and are responsive/accessible (WCAG AA); pricing reflects the `plans` table; contact form reliably creates tickets with spam protection; bureau claims are config-gated and legally reviewed; help center is searchable and editable by non-engineers.
