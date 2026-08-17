/* Rich-text cleanup for ZZZ skill/card descriptions.
   Upstream text embeds game markup that must not leak into the DOM:
     <color=#FFFFFF>…</color>   → keep inner text
     <IconMap:Icon_Normal>      → drop tag
     {LAYOUT_CONSOLECONTROLLER#…}{LAYOUT_FALLBACK#…} → keep fallback only
     <br> / \n                  → line breaks */

/** Minimal safe HTML → plain text used inside `white-space: pre-line`. */
export function stripRichText(input: string | undefined | null): string {
  if (!input) return ''
  return input
    .replace(/<color\s*=\s*(?:'[^']*'|"[^"]*")>/gi, '')
    .replace(/<\/color\s*>/gi, '')
    .replace(/<IconMap:[^>]*>/gi, '')
    .replace(/<BR\s*\/?>/gi, '\n')
    .replace(/\{LAYOUT_CONSOLECONTROLLER#[^}]*\}\{LAYOUT_FALLBACK#([^}]*)\}/g, '$1')
    .replace(/\{LAYOUT_[A-Z]+#[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
