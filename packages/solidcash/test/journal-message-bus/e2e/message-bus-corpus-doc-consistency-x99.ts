export const ROUTE_SCOPE_REASONS = [
  'initial-v1-route-requires-public-visibility',
  'collection-helper-route-not-enabled',
  'mixed-scalar-and-collection-route-not-enabled',
  'result-route-requires-effect-free-handlers',
  'batched-handler-forward-call-not-enabled',
];

export function deriveCorpusHeadlines(gates: any, rejections: any): any {
  const corpora = Object.keys(gates);
  if (corpora.length === 0) throw new Error('X99 consistency refusal: census has no corpora');
  const sumGate = (field: string): number => corpora.reduce((sum, corpus) => {
    const value = gates[corpus]?.[field];
    if (!Number.isInteger(value)) throw new Error(`X99 consistency refusal: ${corpus}.${field} is missing`);
    return sum + value;
  }, 0);
  const refusalEntries = corpora.flatMap((corpus) => Object.entries(rejections[corpus] ?? {}));
  const refusals = refusalEntries.reduce((sum, [, value]) => sum + Number(value), 0);
  const routeScope = refusalEntries.filter(([reason]) => ROUTE_SCOPE_REASONS.includes(reason))
    .reduce((sum, [, value]) => sum + Number(value), 0);
  return {
    contracts: sumGate('contracts'), directOk: sumGate('directOk'), busOk: sumGate('busOk'),
    routed: sumGate('routePresent'), refusals, routeScope,
  };
}

export function assertCorpusReportMatches(markdown: string, headline: any): void {
  const required = [
    ['contracts probed', headline.contracts],
    ['compile in direct mode', headline.directOk],
    ['compile in bus mode', headline.busOk],
    ['routed / eligible / instantiable', headline.routed],
    ['named route refusals', headline.refusals],
  ] as const;
  for (const [label, value] of required) {
    const row = markdown.split('\n').find((line) => line.startsWith(`| ${label} |`));
    const cells = row?.split('|').map((cell) => cell.trim()).filter(Boolean) ?? [];
    const published = cells.at(-1)?.replaceAll('*', '');
    if (published !== String(value)) {
      throw new Error(`X99 consistency refusal: report does not publish ${label}=${value}`);
    }
  }
  if (!markdown.includes(`**${headline.routeScope} of ${headline.refusals}`)) {
    throw new Error(`X99 consistency refusal: route-scope headline is not ${headline.routeScope}/${headline.refusals}`);
  }
  if (!/45 built transactions[\s\S]{0,180}(?:at that commit|`6a685f33` run)/.test(markdown)) {
    throw new Error('X99 consistency refusal: 45 is not labelled as the historical transaction-build run');
  }
}
