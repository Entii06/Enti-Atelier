import { useId } from 'react';
import { Facebook } from 'lucide-react';

export function FacebookLink({ variant = 'surface' }: { variant?: 'glass' | 'surface' }) {
  const tooltipId = useId();

  return (
    <a
      href="https://www.facebook.com/groups/1833433694567301"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Mở cộng đồng học tập trên Facebook (tab mới)"
      aria-describedby={tooltipId}
      className={`group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${
        variant === 'glass'
          ? 'border-white/15 bg-black/45 text-white/85 backdrop-blur-md hover:bg-black/60 hover:text-white'
          : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Facebook className="h-5 w-5" aria-hidden="true" />
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Cộng đồng học tập
      </span>
    </a>
  );
}
