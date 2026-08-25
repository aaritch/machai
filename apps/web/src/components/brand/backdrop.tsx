import { cn } from '@machai/ui';

export type BackdropVariant = 'meeting' | 'field' | 'grid' | 'contour' | 'tonal';

/**
 * Page backdrop.
 *
 * Four whole-page treatments, all drawn in code — no image to ship and nothing
 * to art-direct per breakpoint. The layer is fixed, non-interactive and behind
 * everything (`-z-10`), so it does not scroll away on long pages and never
 * intercepts a click. Page sections must therefore not paint an opaque ground;
 * cards keep theirs on purpose, so content still sits on a solid surface.
 *
 *   meeting — two figures at a handshake across a desk, in silhouette, over the
 *             accent field. The default.
 *   field   — soft accent fields at four corners of the viewport, with the
 *             shield drawn in outline at the top right.
 *   grid    — an 88px rule field, masked so it fades out down the page.
 *   contour — stacked chevrons echoing the mark, over the deep-indigo field.
 *   tonal   — a vertical tonal shift with fine grain and an inset vignette.
 */
export function PageBackdrop({
  variant = 'meeting',
  className,
}: {
  variant?: BackdropVariant;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      {variant === 'meeting' ? (
        <>
          {/* Same accent field as `field` — it carries the colour, and the
              figures sit on top of it rather than replacing it. */}
          <div
            className="absolute inset-0"
            style={{
              background: [
                'radial-gradient(1150px 600px at 12% -12%, rgba(150, 138, 224, 0.30), transparent 66%)',
                'radial-gradient(1000px 560px at 94% -4%, rgba(53, 59, 128, 0.80), transparent 68%)',
                'radial-gradient(1050px 680px at 104% 46%, rgba(150, 138, 224, 0.20), transparent 68%)',
                'radial-gradient(980px 520px at 0% 94%, rgba(150, 138, 224, 0.22), transparent 68%)',
              ].join(','),
            }}
          />

          {/*
            Two figures meeting across a desk, drawn as flat silhouettes.

            Filled rather than outlined, unlike the shield: an outline at this
            scale reads as a diagram, and a silhouette only reads as a figure
            when it is solid. Opacity is kept very low so body text over it
            still clears AA — the figures are texture, not an illustration
            competing with the copy.

            Anchored bottom-right and clipped by the parent, so it sits away
            from the left-aligned hero text at every width without needing
            per-breakpoint art direction.
          */}
          <svg
            viewBox="0 0 460 300"
            fill="none"
            className="absolute -right-16 bottom-0 w-[680px] max-w-[92vw] opacity-[0.13] sm:right-0 lg:w-[820px]"
            style={{ color: 'var(--color-accent-300)' }}
          >
            {/* Desk line the pair sit behind. */}
            <path d="M0 250 H460" stroke="currentColor" strokeWidth="2" opacity="0.55" />

            {/* Left figure — suited, angled toward the centre. */}
            <g fill="currentColor">
              <circle cx="118" cy="74" r="30" />
              {/* Shoulders and torso, with a lapel notch cut by the collar path. */}
              <path d="M60 250 C60 176 84 138 118 138 C152 138 176 176 176 250 Z" />
              {/* Forearm reaching in to the handshake. */}
              <path d="M168 168 C196 178 214 194 232 210 L214 232 C196 218 176 204 154 196 Z" />
            </g>
            {/* Collar V, punched back out in the ground colour so the suit reads. */}
            <path d="M104 142 L118 170 L132 142" stroke="var(--color-neutral-950)" strokeWidth="5" fill="none" />

            {/* Right figure — the customer, seated opposite. */}
            <g fill="currentColor">
              <circle cx="344" cy="82" r="28" />
              <path d="M292 250 C292 182 314 146 344 146 C374 146 396 182 396 250 Z" />
              <path d="M296 176 C270 186 254 200 238 214 L256 234 C272 220 290 208 310 202 Z" />
            </g>
            <path d="M332 150 L344 174 L356 150" stroke="var(--color-neutral-950)" strokeWidth="5" fill="none" />

            {/* Clasped hands where the two forearms meet. */}
            <ellipse cx="236" cy="221" rx="19" ry="15" fill="currentColor" />
          </svg>
        </>
      ) : null}

      {variant === 'field' ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: [
                'radial-gradient(1150px 600px at 12% -12%, rgba(150, 138, 224, 0.30), transparent 66%)',
                'radial-gradient(1000px 560px at 94% -4%, rgba(53, 59, 128, 0.80), transparent 68%)',
                'radial-gradient(1050px 680px at 104% 46%, rgba(150, 138, 224, 0.20), transparent 68%)',
                'radial-gradient(980px 520px at 0% 94%, rgba(150, 138, 224, 0.22), transparent 68%)',
              ].join(','),
            }}
          />
          {/* Outline only — filled bars at this scale read as solid panels. */}
          <svg viewBox="0 0 64 76" fill="none" className="absolute right-3 top-2 w-[560px] opacity-[0.17]">
            <path
              d="M32 3 L61 13 V37 L32 73 L3 37 V13 Z"
              stroke="var(--color-accent-500)"
              strokeWidth="1.1"
              strokeLinejoin="miter"
            />
            <path
              d="M20.25 46 V37 M32 46 V30 M43.75 46 V23"
              stroke="var(--color-accent-400)"
              strokeWidth="2.2"
            />
          </svg>
        </>
      ) : null}

      {variant === 'grid' ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(160, 164, 190, 0.16) 1px, transparent 1px),' +
                'linear-gradient(to bottom, rgba(160, 164, 190, 0.13) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              maskImage:
                'radial-gradient(1400px 1100px at 50% 0%, #000 45%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.25) 100%)',
              WebkitMaskImage:
                'radial-gradient(1400px 1100px at 50% 0%, #000 45%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.25) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(1000px 500px at 18% -12%, rgba(150, 138, 224, 0.28), transparent 68%),' +
                'radial-gradient(800px 420px at 90% 70%, rgba(53, 59, 128, 0.45), transparent 70%)',
            }}
          />
        </>
      ) : null}

      {variant === 'contour' ? (
        <>
          <svg
            viewBox="0 0 1200 900"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
          >
            <g stroke="var(--color-accent-500)" fill="none" strokeWidth="2.6" opacity="0.30">
              <path d="M-200 300 L600 -140 L1400 300" />
              <path d="M-200 470 L600 30 L1400 470" />
              <path d="M-200 640 L600 200 L1400 640" />
              <path d="M-200 810 L600 370 L1400 810" />
              <path d="M-200 980 L600 540 L1400 980" />
            </g>
          </svg>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(1100px 700px at 50% -8%, rgba(53, 59, 128, 0.85), transparent 70%)',
            }}
          />
        </>
      ) : null}

      {variant === 'tonal' ? (
        <>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, #262a60 0%, #1d2038 34%, #161826 62%, #101220 100%)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/><feColorMatrix type='saturate' values='0'/></filter><rect width='180' height='180' filter='url(%23n)' opacity='0.12'/></svg>\")",
            }}
          />
          <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 320px 120px rgba(0,0,0,0.75)' }} />
        </>
      ) : null}
    </div>
  );
}
