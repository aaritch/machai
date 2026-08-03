import { BUREAU_LABELS, BUREAU_SCORE_SCALES, type Bureau } from '@machai/types';
import { Card, CardBody, CardHeader, EmptyState } from '@machai/ui';

/**
 * Credit Progress chart (spec §7.3).
 *
 * SMALL MULTIPLES, one panel per bureau — deliberately not one chart with
 * several lines. Creditsafe scores 0–100 and Equifax Business 0–650, so
 * overlaying them would need two y-axes, which makes the visual distance
 * between two lines meaningless. Separate panels, each on its own scale,
 * is the honest rendering of measures that are not comparable.
 *
 * Each panel therefore has a single series, so no legend is needed — the panel
 * title names it — and colour carries no identity, which sidesteps
 * colour-vision issues entirely.
 *
 * Rendered as server-side SVG: no client JS, works with scripts disabled, and
 * `<title>` elements give every point a native accessible tooltip. A table view
 * beneath each panel carries the same numbers for anyone the chart does not
 * serve.
 */

export interface ScorePoint {
  bureau: Bureau;
  score: number;
  recordedOn: string;
}

const WIDTH = 560;
const HEIGHT = 200;
const PADDING = { top: 16, right: 56, bottom: 28, left: 40 };

export function ScoreProgress({ points }: { points: ScorePoint[] }) {
  const byBureau = new Map<Bureau, ScorePoint[]>();
  for (const point of points) {
    const list = byBureau.get(point.bureau) ?? [];
    list.push(point);
    byBureau.set(point.bureau, list);
  }

  if (byBureau.size === 0) {
    return (
      <Card>
        <CardHeader title="Credit progress" />
        <EmptyState
          title="No score history yet"
          description="Once you pull your first report, each observation is charted here so you can see the trend over time."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {[...byBureau.entries()].map(([bureau, series]) => (
        <BureauPanel key={bureau} bureau={bureau} series={series} />
      ))}
    </div>
  );
}

function BureauPanel({ bureau, series }: { bureau: Bureau; series: ScorePoint[] }) {
  const scale = BUREAU_SCORE_SCALES[bureau];
  const sorted = [...series].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = latest && first ? latest.score - first.score : 0;

  return (
    <Card>
      <CardHeader
        title={BUREAU_LABELS[bureau]}
        description={`Scored ${scale.label}. ${sorted.length} observation${sorted.length === 1 ? '' : 's'}.`}
        action={
          sorted.length > 1 ? (
            <span
              className={
                delta >= 0
                  ? 'text-sm font-semibold text-accent-700 dark:text-accent-300'
                  : 'text-sm font-semibold text-red-700 dark:text-red-400'
              }
            >
              {delta >= 0 ? '+' : ''}
              {delta} since first pull
            </span>
          ) : null
        }
      />
      <CardBody>
        {sorted.length === 1 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            One observation so far ({sorted[0]?.score} on {scale.label}). A trend needs at least two
            — pull again next month.
          </p>
        ) : (
          <LineChart series={sorted} min={scale.min} max={scale.max} label={BUREAU_LABELS[bureau]} />
        )}

        {/* The same numbers, for anyone the chart does not serve. */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-accent-700 dark:text-accent-300">
            View as table
          </summary>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">
              {BUREAU_LABELS[bureau]} score history, scored {scale.label}
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th scope="col" className="py-2 font-medium text-neutral-500">Date</th>
                <th scope="col" className="py-2 font-medium text-neutral-500">Score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((point) => (
                <tr key={point.recordedOn} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                  <td className="py-2 text-neutral-700 dark:text-neutral-300">{point.recordedOn}</td>
                  <td className="py-2 tabular-nums text-neutral-900 dark:text-neutral-100">
                    {point.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </CardBody>
    </Card>
  );
}

function LineChart({
  series,
  min,
  max,
  label,
}: {
  series: ScorePoint[];
  min: number;
  max: number;
  label: string;
}) {
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const x = (index: number) =>
    PADDING.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
  const y = (score: number) =>
    PADDING.top + plotHeight - ((score - min) / (max - min)) * plotHeight;

  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.score)}`).join(' ');
  const gridValues = [min, min + (max - min) / 2, max];
  const last = series[series.length - 1];

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full min-w-[32rem]"
        role="img"
        aria-label={`${label} score trend across ${series.length} observations, from ${series[0]?.score} to ${last?.score}`}
      >
        {/* Recessive grid — present for reference, never competing with data. */}
        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={y(value)}
              y2={y(value)}
              className="stroke-neutral-200 dark:stroke-neutral-800"
              strokeWidth="1"
            />
            <text
              x={PADDING.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              className="fill-neutral-500 text-[10px] tabular-nums dark:fill-neutral-400"
            >
              {Math.round(value)}
            </text>
          </g>
        ))}

        {/* 2px line, single series. */}
        <path
          d={path}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-accent-600 dark:stroke-accent-400"
        />

        {series.map((point, index) => (
          <g key={point.recordedOn}>
            {/* A 2px surface ring keeps markers legible where the line passes
                behind them. */}
            <circle
              cx={x(index)}
              cy={y(point.score)}
              r="5"
              className="fill-white stroke-accent-600 dark:fill-neutral-900 dark:stroke-accent-400"
              strokeWidth="2"
            >
              <title>{`${point.recordedOn}: ${point.score}`}</title>
            </circle>
          </g>
        ))}

        {/* Only the latest point is labelled — a number on every point is noise. */}
        {last ? (
          <text
            x={x(series.length - 1) + 10}
            y={y(last.score) + 4}
            className="fill-neutral-900 text-xs font-semibold tabular-nums dark:fill-neutral-100"
          >
            {last.score}
          </text>
        ) : null}

        <text
          x={PADDING.left}
          y={HEIGHT - 8}
          className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
        >
          {series[0]?.recordedOn}
        </text>
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-neutral-500 text-[10px] dark:fill-neutral-400"
        >
          {last?.recordedOn}
        </text>
      </svg>
    </figure>
  );
}
