import { useLifeHubStore } from '../store/store';
import type { ValveStatusReport } from '../types';

export function GasControlPanel() {
  const telemetry = useLifeHubStore((s) => s.telemetry);

  const valves = telemetry?.valves || {};
  const manualOverride = telemetry?.pid.manualOverride;
  const cmdCount = telemetry?.pid.commandCounter || 0;

  const valveList: Array<{ id: string; name: string; role: string; gas: string }> = [
    { id: 'V-O2-01', name: '主供氧阀', role: 'PRIMARY O₂', gas: 'OXYGEN' },
    { id: 'V-O2-02', name: '备用供氧阀', role: 'SECONDARY O₂', gas: 'OXYGEN' },
    { id: 'V-CO2-A', name: 'CO₂ 洗涤器 A', role: 'SCRUBBER A', gas: 'CO2' },
    { id: 'V-CO2-B', name: 'CO₂ 洗涤器 B', role: 'SCRUBBER B', gas: 'CO2' },
    { id: 'V-N2-BAL', name: 'N₂ 压载阀', role: 'BALLAST N₂', gas: 'N2' },
    { id: 'V-O2-EMG', name: '应急供氧', role: 'EMERGENCY O₂', gas: 'EMG' },
  ];

  const pidO2 = telemetry?.pid.o2;
  const pidCO2 = telemetry?.pid.co2;

  return (
    <div className="hud-panel hud-corner p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="hud-title">
          <span className="status-indicator" style={{ background: manualOverride ? '#f59e0b' : '#22c55e' }} />
          配气控制 GAS CONTROL
        </div>
        <div className="font-mono text-[10px] text-gray-500">
          CYCLES: <span className="text-neon-cyan">{cmdCount}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {valveList.map((v) => (
          <ValveRow key={v.id} v={v} status={valves[v.id]} />
        ))}
      </div>

      <div className="pt-2 border-t border-cabin-600/30 space-y-2">
        <div className="hud-title text-[10px]">PID 控制器状态</div>
        <div className="space-y-1.5 font-mono text-[10px]">
          <PIDBar label="O₂ LOOP" output={pidO2?.lastOutput ?? 0} max={5000} color="#06f0ff" />
          <PIDBar label="CO₂ LOOP" output={pidCO2?.lastOutput ?? 0} max={10000} color="#22d3ee" />
        </div>
      </div>

      {manualOverride && (
        <div className="text-center py-1.5 bg-neon-amber/10 border border-neon-amber/40 rounded">
          <div className="font-display text-[11px] text-neon-amber tracking-widest glow-text-amber">
            ⚠ 手动超控 ACTIVE
          </div>
        </div>
      )}
    </div>
  );
}

function ValveRow({ v, status }: { v: { id: string; name: string; role: string; gas: string }; status?: ValveStatusReport }) {
  const state = status?.currentState ?? 'closed';
  const fault = (status?.faultCode ?? 0) !== 0;

  const stateConfig: Record<string, { text: string; color: string; bg: string }> = {
    open: { text: 'OPEN', color: '#22c55e', bg: 'bg-green-500/15 border-green-500/40' },
    closed: { text: 'CLOSED', color: '#64748b', bg: 'bg-cabin-700/50 border-cabin-600/50' },
    transitioning: { text: 'ACTIVE', color: '#f59e0b', bg: 'bg-amber-500/15 border-amber-500/50' },
  };
  const sc = stateConfig[state] || stateConfig.closed;

  const gasColors: Record<string, string> = {
    OXYGEN: '#06f0ff',
    CO2: '#22d3ee',
    N2: '#94a3b8',
    EMG: '#ef4444',
  };

  return (
    <div className={`p-1.5 rounded border flex items-center gap-2 ${sc.bg} ${fault ? 'border-o2-low/60 bg-o2-low/10' : ''}`}>
      <div
        className="w-1.5 h-6 rounded-full"
        style={{ background: gasColors[v.gas], boxShadow: `0 0 4px ${gasColors[v.gas]}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[10px] text-gray-300 truncate tracking-wide">{v.role}</div>
        <div className="font-mono text-[8px] text-gray-500 truncate">{v.id}</div>
      </div>
      <div className="text-right">
        <div
          className="font-display text-[9px] tracking-wider"
          style={{ color: sc.color, textShadow: fault ? '0 0 6px #ef4444' : `0 0 4px ${sc.color}60` }}
        >
          {fault ? 'FAULT' : sc.text}
        </div>
        {status && (
          <div className="font-mono text-[8px] text-gray-600">
            #{status.cycleCount}
          </div>
        )}
      </div>
    </div>
  );
}

function PIDBar({ label, output, max, color }: { label: string; output: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (output / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-gray-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-cabin-900 rounded overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}30, ${color})`,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
      <span className="w-14 text-right tabular-nums text-gray-400">{output.toFixed(0)}ms</span>
    </div>
  );
}
