export function exceptionAlert(e) { globalThis.__goFehler = (globalThis.__goFehler || []).concat(String(e && e.stack || e)); }
