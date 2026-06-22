import { useLifeHubStore } from '../store/store';
import { SafetyIndicators } from '../types';

export function TopHeader() {
  const state = useLifeHubStore((s) => s.state);
  const now = new Date();

  return (
    <header className="hud-panel hud-corner flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-neon-cyan/60 flex items-center justify-center bg-cabin-900/80 shadow-[0_0_15px_rgba(6,240,255,0.2)]">
            <span className="font-display font-black text-neon-cyan text-lg glow-text-cyan">O₂</span>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-o2-safe shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-white tracking-wider">
            奋斗者号 · 生命维持控制中枢
          </h1>
          <p className="font-mono text-[10px] text-gray-500 tracking-widest">
            FENDOUZHE · CREWED DEEP-SEA VEHICLE · LIFE SUPPORT C&C v1.0
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {state && <MissionPhaseBadge status={state.safetyIndicators} />}
        <ClockDisplay date={now} />
      </div>
    </header>
  );
}

function MissionPhaseBadge({ status }: { status: SafetyIndicators }) {
  const phases: Record<SafetyIndicators['overallStatus'], { label: string; bg: string; text: string; desc: string }> = {
    normal: { label: 'SCIENCE OPERATION', bg: 'bg-o2-safe/15 border-o2-safe/40', text: 'text-o2-safe glow-text-green', desc: '作业中 · 系统正常' },
    warning: { label: 'ACTIVE MONITORING', bg: 'bg-neon-amber/15 border-neon-amber/50', text: 'text-neon-amber glow-text-amber', desc: '监控中 · 参数偏离' },
    critical: { label: 'SAFETY PROTOCOL', bg: 'bg-orange-500/15 border-orange-500/50', text: 'text-orange-400', desc: '安全协议 · 主动干预' },
    fatal: { label: 'EMERGENCY ASCENT', bg: 'bg-o2-low/15 border-o2-low/60', text: 'text-o2-low glow-text-red', desc: '紧急上浮！' },
  };
  const p = phases[status.overallStatus];

  return (
    <div className={`hud-panel hud-corner px-4 py-1.5 border rounded-md ${p.bg}`}>
      <div className={`font-display text-xs font-bold tracking-[0.15em] ${p.text}`}>
        ◆ {p.label}
      </div>
      <div className="font-mono text-[10px] text-gray-400 text-right">{p.desc}</div>
    </div>
  );
}

function ClockDisplay({ date }: { date: Date }) {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  const ms = Math.floor(date.getMilliseconds() / 100);
  return (
    <div className="text-right">
      <div className="font-mono text-xl font-bold text-neon-cyan glow-text-cyan tabular-nums leading-none">
        {hh}:{mm}:<span className="text-white">{ss}</span>
        <span className="text-xs text-neon-cyan/70 ml-0.5 align-top">.{ms}</span>
      </div>
      <div className="font-mono text-[10px] text-gray-500 tracking-widest">
        MISSION ELAPSED · T+04:17:22
      </div>
    </div>
  );
}
