import { Github } from 'lucide-react';

export function GitHubLink({ variant = 'surface' }: { variant?: 'glass' | 'surface' }) {
  return (
    <a
      href="https://github.com/Entii06/Enti-Atelier"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Mở repository ENTI Atelier trên GitHub (tab mới)"
      title="ENTI Atelier trên GitHub"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] ${
        variant === 'glass'
          ? 'border-white/15 bg-black/45 text-white/85 backdrop-blur-md hover:bg-black/60 hover:text-white'
          : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Github className="h-5 w-5" aria-hidden="true" />
    </a>
  );
}
