// Begrenzt den laufenden Node-Prozess auf die Kerne 0-3 (Bitmaske 15) und Prioritaet Idle.
// Wird als ERSTE Zeile in jedem rechenintensiven Test- und Messskript importiert:
//   import 'file:///C:/Users/erche/Desktop/claude_projecto/bb-lauf2/tools/cpu.mjs';
// Ohne die file:///-URL scheitert der Import unter Windows.
// Kindprozesse (z. B. Headless-Chrome) erben Affinitaet und Prioritaetsklasse vom Elternprozess.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const AFFINITY_MASK = 15;

function limitSelf() {
  if (process.platform !== 'win32') return { applied: false, reason: 'not windows' };
  if (process.env.BB_NO_CPU_LIMIT) return { applied: false, reason: 'disabled by env' };
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = [
    `$p = Get-Process -Id ${process.pid}`,
    `$p.ProcessorAffinity = [IntPtr]${AFFINITY_MASK}`,
    `$p.PriorityClass = 'Idle'`,
    // Rueckgabe zum Gegenlesen: Maske und Klasse nach dem Setzen
    `Write-Output ($p.ProcessorAffinity.ToInt64().ToString() + ' ' + $p.PriorityClass)`,
  ].join('; ');
  try {
    const out = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    }).trim();
    const [mask, cls] = out.split(/\s+/);
    return { applied: Number(mask) === AFFINITY_MASK && cls === 'Idle', mask: Number(mask), priority: cls };
  } catch (err) {
    // Eine fehlgeschlagene Begrenzung darf Tests nicht verhindern, wird aber sichtbar gemacht
    return { applied: false, reason: String(err && err.message ? err.message : err) };
  }
}

export const cpuLimit = limitSelf();
