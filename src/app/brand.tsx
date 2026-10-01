/** Nom, version et logo du site, à la manière de l'en-tête de SkyCrypt. */
export const APP_NAME = 'Sky-Helper'

/** « v1.8 » : la version de package.json sans le dernier chiffre, comme les tags du dépôt. */
export const APP_VERSION = `v${__APP_VERSION__.split('.').slice(0, 2).join('.')}`

/** Logo : pousse blanche sur un carré vert (même dessin que public/favicon.svg). */
export function Logo({ className = '' }: { readonly className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <rect width="32" height="32" rx="8" fill="#4e9f53" />
      <path d="M16 25V15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M16 16c0-5 3.5-8.5 9-8.5 0 5.5-3.5 8.5-9 8.5Z" fill="#fff" />
      <path d="M16 19c0-4-2.8-6.8-7.5-6.8 0 4.5 2.8 6.8 7.5 6.8Z" fill="#e3f5e3" />
    </svg>
  )
}
