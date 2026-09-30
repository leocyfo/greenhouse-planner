/** Identifiants DOM qui relient un onglet à son panneau (aria-controls / aria-labelledby). */
export function tabElementId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`
}

export function tabPanelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`
}
