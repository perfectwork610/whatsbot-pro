import type { Message, State } from './types';

export function overviewData(state: State, simulated: boolean, now = Date.now()) {
  const messages = state.messages.filter((message) => !!message.simulated === simulated);
  const sent = messages.filter(
    (message) =>
      message.direction === 'out' &&
      ['accepted', 'sent', 'delivered', 'read', 'simulated'].includes(message.status),
  );
  const delivered = sent.filter((message) => ['delivered', 'read'].includes(message.status));
  const firstSent = new Map<string, number>();
  for (const message of sent) {
    const key = `${message.accountId}:${message.contactId}`;
    firstSent.set(key, Math.min(firstSent.get(key) ?? Infinity, Date.parse(message.createdAt)));
  }
  const replied = new Set(
    messages
      .filter(
        (message) =>
          message.direction === 'in' &&
          Date.parse(message.createdAt) >=
            (firstSent.get(`${message.accountId}:${message.contactId}`) ?? Infinity),
      )
      .map((message) => `${message.accountId}:${message.contactId}`),
  );
  const week = 7 * 86400000;
  function change(records: { createdAt: string }[]) {
    const recent = records.filter((record) => {
      const age = now - Date.parse(record.createdAt);
      return age >= 0 && age < week;
    }).length;
    const previous = records.filter((record) => {
      const age = now - Date.parse(record.createdAt);
      return age >= week && age < week * 2;
    }).length;
    return { recent, percent: previous ? ((recent - previous) / previous) * 100 : null };
  }
  return {
    contacts: state.contacts.length,
    sent: sent.length,
    delivered: delivered.length,
    replies: replied.size,
    deliveryRate: sent.length ? (delivered.length / sent.length) * 100 : 0,
    replyRate: firstSent.size ? (replied.size / firstSent.size) * 100 : 0,
    contactChange: change(state.contacts),
    sentChange: change(sent),
  };
}

export function overviewMessageDays(
  messages: Message[],
  simulated: boolean,
  locale: string,
  now = new Date(),
) {
  const filtered = messages.filter((message) => !!message.simulated === simulated);
  return Array.from({ length: 7 }, (_, index) => {
    const start = new Date(now);
    start.setDate(start.getDate() - 6 + index);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const selected = filtered.filter(
      (message) =>
        Date.parse(message.createdAt) >= start.getTime() &&
        Date.parse(message.createdAt) < end.getTime(),
    );
    return {
      day: start.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      sent: selected.filter(
        (message) =>
          message.direction === 'out' &&
          ['accepted', 'sent', 'delivered', 'read', 'simulated'].includes(message.status),
      ).length,
      delivered: selected.filter(
        (message) => message.direction === 'out' && ['delivered', 'read'].includes(message.status),
      ).length,
    };
  });
}
