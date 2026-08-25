import { appUrl, brand, disclosures } from '@machai/config/public';
import { EMAIL_TEMPLATES, type EmailTemplateKey } from '@machai/types';

/**
 * Transactional email templates.
 *
 * Two rules hold across all of them:
 *
 *  1. No sensitive values. Templates receive ids, names, and counts — never an
 *     EIN, never a report payload. Email is stored unencrypted on servers we do
 *     not control.
 *  2. No outcome promises. "Your score will improve" is a regulatory problem
 *     (spec §14.3); these say what happened, not what will happen.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export type TemplateData = Record<string, string | number | boolean | null>;

/** Escapes untrusted values before they reach the HTML body. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1f1d;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e6e4;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-size:15px;font-weight:600;color:#2f6f4e;letter-spacing:-0.01em;">${esc(brand.name)}</div>
    </td></tr>
    <tr><td style="padding:4px 28px 0;">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:600;">${esc(heading)}</h1>
      ${bodyHtml}
    </td></tr>
    ${
      cta
        ? `<tr><td style="padding:20px 28px 4px;">
             <a href="${esc(cta.url)}" style="display:inline-block;background:#2f6f4e;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:15px;">${esc(cta.label)}</a>
           </td></tr>`
        : ''
    }
    <tr><td style="padding:24px 28px 28px;">
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b716d;border-top:1px solid #e3e6e4;padding-top:16px;">
        ${esc(brand.name)} · <a href="${esc(appUrl)}/legal/privacy" style="color:#6b716d;">Privacy</a> ·
        <a href="${esc(appUrl)}/legal/terms" style="color:#6b716d;">Terms</a> ·
        <a href="${esc(appUrl)}/contact" style="color:#6b716d;">Contact</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#33403a;">${esc(text)}</p>`;
}

type Renderer = (data: TemplateData) => RenderedEmail;

const RENDERERS: Record<EmailTemplateKey, Renderer> = {
  [EMAIL_TEMPLATES.verifyEmail]: (d) => {
    const url = `${appUrl}/verify-email?token=${encodeURIComponent(String(d.token ?? ''))}`;
    return {
      subject: `Confirm your email address`,
      text: `Confirm your email address to finish setting up your ${brand.name} account.\n\n${url}\n\nThis link expires in 24 hours. If you did not create an account, ignore this message.`,
      html: layout(
        'Confirm your email address',
        p(`Confirm your address to finish setting up your ${brand.name} account. Until you do, you can look around but cannot subscribe or start reporting.`) +
          p('This link expires in 24 hours.'),
        { label: 'Confirm email', url },
      ),
    };
  },

  [EMAIL_TEMPLATES.passwordReset]: (d) => {
    const url = `${appUrl}/reset-password?token=${encodeURIComponent(String(d.token ?? ''))}`;
    return {
      subject: 'Reset your password',
      text: `Use this link to set a new password:\n\n${url}\n\nIt expires in one hour and can be used once. If you did not request it, no action is needed — your password has not changed.`,
      html: layout(
        'Reset your password',
        p('Use the button below to set a new password. The link expires in one hour and works once.') +
          p('If you did not request this, no action is needed — your password has not changed.'),
        { label: 'Set a new password', url },
      ),
    };
  },

  [EMAIL_TEMPLATES.contactAutoresponder]: (d) => ({
    subject: `We received your message (#${String(d.ticketRef ?? '')})`,
    text: `Thanks for getting in touch. Your message is now ticket #${d.ticketRef}. ${brand.responseTime}. Our hours are ${brand.hours}.`,
    html: layout(
      'We received your message',
      p(`Thanks for getting in touch — your message is now ticket #${String(d.ticketRef ?? '')}.`) +
        p(`${brand.responseTime}. Our support hours are ${brand.hours}.`),
    ),
  }),

  [EMAIL_TEMPLATES.ticketReply]: (d) => {
    const url = `${appUrl}/dashboard/tickets/${encodeURIComponent(String(d.ticketId ?? ''))}`;
    return {
      subject: `Reply on your ticket: ${String(d.subject ?? '')}`,
      text: `There is a new reply on your support ticket.\n\n${url}`,
      html: layout(
        'New reply on your ticket',
        p(`There is a new reply on "${String(d.subject ?? '')}".`),
        { label: 'View the conversation', url },
      ),
    };
  },




  [EMAIL_TEMPLATES.paymentFailed]: () => {
    const url = `${appUrl}/dashboard/billing`;
    return {
      subject: 'We could not process your payment',
      text: `A payment on your subscription did not go through. We will retry automatically over the next few days. Update your card to avoid interruption.\n\n${url}`,
      html: layout(
        'We could not process your payment',
        p('A payment on your subscription did not go through. We will retry automatically over the next few days, and your access continues in the meantime.') +
          p('Updating your card now avoids any interruption.'),
        { label: 'Update payment method', url },
      ),
    };
  },

  [EMAIL_TEMPLATES.subscriptionActivated]: (d) => {
    const url = `${appUrl}/dashboard`;
    return {
      subject: `Your ${String(d.planName ?? '')} plan is active`,
      text: `Your ${d.planName} plan is active. Your payment activity will be included in the next monthly reporting cycle.\n\n${url}`,
      html: layout(
        `Your ${String(d.planName ?? '')} plan is active`,
        p('Your payment activity will be included in the next monthly reporting cycle.') +
          p(disclosures.reportingDisclosure),
        { label: 'Open your dashboard', url },
      ),
    };
  },

  [EMAIL_TEMPLATES.enterpriseLead]: (d) => ({
    subject: `Premier enquiry from ${String(d.companyName ?? '')}`,
    text: `New Premier enquiry.\n\nCompany: ${d.companyName}\nContact: ${d.contactName}\nEmail: ${d.email}\nPhone: ${d.phone ?? '—'}`,
    html: layout(
      'New Premier enquiry',
      p(`Company: ${String(d.companyName ?? '')}`) +
        p(`Contact: ${String(d.contactName ?? '')} · ${String(d.email ?? '')}`) +
        p(`Phone: ${String(d.phone ?? '—')}`),
    ),
  }),
};

export function renderTemplate(template: EmailTemplateKey, data: TemplateData): RenderedEmail {
  const renderer = RENDERERS[template];
  if (!renderer) throw new Error(`Unknown email template: ${template}`);
  return renderer(data);
}
