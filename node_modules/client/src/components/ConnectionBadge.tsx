import { useLifeHubStore } from '../store/store';
import { ConnectionStatus } from '../types';

export function ConnectionBadge() {
  const conn = useLifeHubStore((s) => s.connection);
  const fps = useLifeHubStore((s) => s.fps);

  const { color, label, glow } = statusColors(conn);

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${color} ${glow}`}
        />
        <span className={`font-display uppercase tracking-wider ${label}`}>
          {conn.connected ? 'LIVE' : conn.reconnecting ? 'RECONNECTING' : 'OFFLINE'}
        </span>
      </div>
      {conn.connected && (
        <div className="flex items-center gap-3 font-mono text-gray-400">
          <span>
            <span className="text-neon-cyan/80">RTT</span>{' '}
            <span className={conn.latencyMs < 50 ? 'text-o2-safe' : conn.latencyMs < 150 ? 'text-neon-amber' : 'text-o2-low'}>
              {conn.latencyMs >= 0 ? `${conn.latencyMs}ms` : '--'}
            </span>
          </span>
          <span>
            <span className="text-neon-cyan/80">FPS</span>{' '}
            <span className={fps > 45 ? 'text-o2-safe' : fps > 25 ? 'text-neon-amber' : 'text-o2-low'}>
              {fps}
            </span>
          </span>
          {conn.reconnecting && (
            <span className="text-neon-amber animate-pulse">重连 #{conn.attempt}</span>
          )}
        </div>
      )}
    </div>
  );
}

function statusColors(conn: ConnectionStatus): { color: string; label: string; glow: string } {
  if (conn.connected) {
    return {
      color: 'bg-o2-safe',
      label: 'text-o2-safe',
      glow: 'shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse-slow',
    };
  }
  if (conn.reconnecting) {
    return {
      color: 'bg-neon-amber',
      label: 'text-neon-amber',
      glow: 'shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse',
    };
  }
  return {
    color: 'bg-o2-low',
    label: 'text-o2-low',
    glow: 'shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse',
  };
}
