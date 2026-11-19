import React from 'react';
import { Team } from '../game/types';

interface TeamBadgeProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg';
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({ team, size = 'md' }) => {
  const dims =
    size === 'sm' ? 'w-7 h-5 text-[9px]' : size === 'lg' ? 'w-11 h-8 text-xs' : 'w-9 h-6 text-[10px]';

  if (team.league === 'international') {
    return (
      <span
        className={`inline-flex items-center justify-center rounded border border-white/20 overflow-hidden shrink-0 font-mono-num font-bold tracking-tight ${dims}`}
        style={{
          background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.primaryColor} 58%, ${team.secondaryColor} 58%, ${team.secondaryColor} 100%)`,
          color: '#ffffff',
          textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        }}
        aria-hidden="true"
      >
        {team.code}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border border-white/25 shrink-0 font-mono-num font-bold tracking-tight shadow-sm ${dims}`}
      style={{
        background: `linear-gradient(145deg, ${team.primaryColor}, ${team.secondaryColor})`,
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.85)',
      }}
      aria-hidden="true"
    >
      {team.code}
    </span>
  );
};
