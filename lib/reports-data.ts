import type { Message, State } from './types';
const accepted = new Set(['accepted', 'sent', 'delivered', 'read', 'simulated']);
export function reportSummary(messages: Message[]) {
  const outgoing = messages.filter((m) => m.direction === 'out');
  const sent = outgoing.filter((m) => accepted.has(m.status)).length;
  const delivered = outgoing.filter((m) => m.status === 'delivered' || m.status === 'read').length;
  const read = outgoing.filter((m) => m.status === 'read').length;
  const failed = outgoing.filter((m) => m.status === 'failed').length;
  return {
    sent,
    delivered,
    read,
    failed,
    deliveryRate: sent ? (delivered / sent) * 100 : 0,
    readRate: sent ? (read / sent) * 100 : 0,
    failureRate: sent + failed ? (failed / (sent + failed)) * 100 : 0,
  };
}
export function reportData(
  state: State,
  simulated: boolean,
  days: number,
  timeZone = 'UTC',
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const key = (date: Date) => {
    const parts = formatter.formatToParts(date);
    return ['year', 'month', 'day']
      .map((type) => parts.find((p) => p.type === type)!.value)
      .join('-');
  };
  const today = key(now);
  function offset(n: number) {
    const date = new Date(today + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + n);
    return date.toISOString().slice(0, 10);
  }
  const start = offset(1 - days),
    previousStart = offset(1 - days * 2);
  const dated = state.messages
    .filter(
      (m) =>
        !!m.simulated === simulated &&
        Number.isFinite(Date.parse(m.createdAt)) &&
        Date.parse(m.createdAt) <= now.getTime(),
    )
    .map((m) => ({ message: m, key: key(new Date(m.createdAt)) }));
  const messages = dated.filter((x) => x.key >= start && x.key <= today).map((x) => x.message);
  const previous = reportSummary(
    dated.filter((x) => x.key >= previousStart && x.key < start).map((x) => x.message),
  ).sent;
  const summary = reportSummary(messages);
  const buckets = new Map<string, Message[]>();
  for (const row of dated) {
    if (row.key < start || row.key > today) continue;
    const bucket = buckets.get(row.key) || [];
    bucket.push(row.message);
    buckets.set(row.key, bucket);
  }
  const chart = Array.from({ length: days }, (_, i) => {
    const day = offset(i - days + 1);
    return { key: day, ...reportSummary(buckets.get(day) || []) };
  });
  const campaignMessages = new Map<string, Message[]>();
  for (const m of messages) {
    if (!m.campaignId) continue;
    const bucket = campaignMessages.get(m.campaignId) || [];
    bucket.push(m);
    campaignMessages.set(m.campaignId, bucket);
  }
  const campaigns = state.campaigns
    .filter(
      (c) =>
        campaignMessages.has(c.id) ||
        (Number.isFinite(Date.parse(c.createdAt)) &&
          key(new Date(c.createdAt)) >= start &&
          Date.parse(c.createdAt) <= now.getTime()),
    )
    .map((c) => ({ campaign: c, ...reportSummary(campaignMessages.get(c.id) || []) }));
  return {
    messages,
    summary,
    previous,
    change: previous ? ((summary.sent - previous) / previous) * 100 : null,
    chart,
    campaigns,
    start,
    end: today,
  };
}
