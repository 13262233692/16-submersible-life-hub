import { useLifeHubStore } from '../store/store';

const severityColor: Record<string, string> = {
  warning: '#FACC15',
  critical: '#FB923C',
  fatal: '#EF4444',
  info: '#38BDF8',
};

export function LifeSupportAlertBorder() {
  const activeAlert = useLifeHubStore((s) => s.activeAlert);
  if (!activeAlert) return null;

  const color = severityColor[activeAlert.severity] ?? severityColor.warning;

  return (
    <>
      <style>{`
        @keyframes ls-pulse-border {
          0%, 100% {
            box-shadow:
              inset 0 0 0 2px ${color},
              inset 0 0 32px 6px rgba(250, 204, 21, 0.25),
              0 0 12px 2px ${color};
            opacity: 0.55;
          }
          35% {
            box-shadow:
              inset 0 0 0 6px ${color},
              inset 0 0 96px 24px rgba(250, 204, 21, 0.55),
              0 0 48px 10px ${color};
            opacity: 1;
          }
          70% {
            box-shadow:
              inset 0 0 0 3px ${color},
              inset 0 0 48px 12px rgba(250, 204, 21, 0.35),
              0 0 20px 4px ${color};
            opacity: 0.85;
          }
        }
        @keyframes ls-ribbon-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `}</style>
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          animation: 'ls-pulse-border 1.4s ease-in-out infinite',
          border: `4px solid ${color}`,
          borderRadius: 4,
        }}
      />
      <div
        className="pointer-events-none fixed top-2 left-1/2 z-40 -translate-x-1/2 px-5 py-1.5 rounded-md font-bold text-xs tracking-widest uppercase"
        style={{
          background: `${color}`,
          color: '#0b1220',
          animation: 'ls-ribbon-shake 0.8s linear infinite',
          boxShadow: `0 0 24px 6px ${color}`,
        }}
      >
        ⚠ {activeAlert.severity === 'fatal' ? 'LIFE SUPPORT FAIL-IMMINENT' : 'LIFE SUPPORT WARNING'} · 急性 CO₂ 中毒告警
      </div>
    </>
  );
}
