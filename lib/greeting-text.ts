export function greetingText(template: string, name: string, business: string) {
  return template
    .replace(/\{\{\s*(nome|name|empresa|business)\s*\}\}/gi, (_, key: string) =>
      ['nome', 'name'].includes(key.toLowerCase()) ? name : business,
    )
    .slice(0, 4000);
}
