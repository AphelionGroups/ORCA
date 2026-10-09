/** Nonessential preferences must not prevent an embedded demo from opening. */
export function readDemoSetting(key: string): string | null {
  try { return localStorage.getItem(`orca-demo-${key}`); } catch { return null; }
}
export function writeDemoSetting(key: string, value: string) {
  try { localStorage.setItem(`orca-demo-${key}`, value); } catch { /* Keep the current selection in memory. */ }
}
