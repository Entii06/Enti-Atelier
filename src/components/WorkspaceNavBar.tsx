import React from 'react';
import { NavSection } from '../types';

interface WorkspaceNavBarProps {
  activeSection: NavSection;
  dueCount: number;
  unplacedPiecesCount?: number;
  onSelectSection: (section: NavSection) => void;
  variant?: 'glass' | 'surface';
  className?: string;
}

export const WorkspaceNavBar: React.FC<WorkspaceNavBarProps> = ({
  activeSection,
  dueCount,
  unplacedPiecesCount = 0,
  onSelectSection,
  variant = 'surface',
  className = '',
}) => {
  const isGlass = variant === 'glass';

  const containerClasses = isGlass
    ? 'bg-black/45 backdrop-blur-md border-white/15 text-white'
    : 'bg-[var(--bg-surface)] border-[var(--border-strong)] text-[var(--text-primary)]';

  const dividerClasses = isGlass
    ? 'text-white/25'
    : 'text-[var(--border-strong)]';

  const navItems: Array<[NavSection, string]> = [
    ['pomodoro', 'Pomodoro'],
    ['srs', dueCount > 0 ? `Ôn tập SRS (${dueCount})` : 'Ôn tập SRS'],
    ['vocabulary', 'Kho từ vựng'],
    [
      'gallery',
      unplacedPiecesCount > 0
        ? `Kho ảnh (+${unplacedPiecesCount})`
        : 'Kho ảnh',
    ],
    ['analytics', 'Thống kê'],
  ];

  return (
    <div
      className={`w-full lg:w-auto lg:min-w-[52%] lg:max-w-[65%] min-w-0 ${className}`}
    >
      <div
        className={`w-full flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-5 px-5 py-2.5 rounded-2xl border ${containerClasses}`}
      >
        <button
          type="button"
          onClick={() => onSelectSection('pomodoro')}
          className={`font-serif text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap shrink-0 cursor-pointer ${
            isGlass ? 'text-white' : 'text-[var(--text-primary)]'
          }`}
        >
          Enti Atelier
        </button>

        <span
          className={`hidden sm:inline shrink-0 ${dividerClasses}`}
          aria-hidden="true"
        >
          |
        </span>

        <nav
          aria-label="Điều hướng chính"
          className="flex-1 flex items-center justify-between gap-3.5 sm:gap-4 text-xs sm:text-sm font-medium overflow-x-auto thin-glass-scrollbar"
        >
          {navItems.map(([key, label]) => {
            const isActive = activeSection === key;
            const itemClasses = isGlass
              ? isActive
                ? 'text-white font-semibold border-b-2 border-amber-400'
                : 'text-white/80 hover:text-white border-b-2 border-transparent'
              : isActive
              ? 'text-[var(--text-primary)] font-semibold border-b-2 border-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-b-2 border-transparent';

            return (
              <button
                key={key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectSection(key)}
                className={`pb-0.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${itemClasses}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
