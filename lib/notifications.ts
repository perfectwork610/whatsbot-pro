export type ActivityEvent = { id?: string; at: string; text: string; readAt?: string };
export function notificationKey(event: ActivityEvent) {
  return event.id || JSON.stringify([event.at, event.text]);
}
export function markNotificationsRead(events: ActivityEvent[], ids: unknown) {
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string'))
    throw new Error('Notificações inválidas.');
  const selected = new Set(ids);
  for (const event of events) {
    if (selected.has(notificationKey(event))) event.readAt ||= new Date().toISOString();
  }
}
