/**
 * Hugeicons ships icon data as [tag, attrs] tuples with React-style attribute
 * names. There is no vanilla renderer package, so this turns the data into SVG
 * markup usable in the shadow-DOM overlay and the options page.
 */
export type IconData = readonly (readonly [string, { readonly [key: string]: string | number }])[];

const KEBAB = /[A-Z]/g;

function attrs(source: { readonly [key: string]: string | number }): string {
  return Object.entries(source)
    .filter(([name]) => name !== 'key')
    .map(([name, value]) => `${name.replace(KEBAB, (c) => `-${c.toLowerCase()}`)}="${value}"`)
    .join(' ');
}

export function icon(data: IconData, size = 18): string {
  const body = data.map(([tag, props]) => `<${tag} ${attrs(props)}/>`).join('');
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">${body}</svg>`;
}
