import { useLifeHubStore } from '../store/store';
import { SafetyIndicators } from '../types';

export function BiochemicalGauges() {
  const state = useLifeHubStore((s) => s.state);

  if (!state) {
    return (
      <div className="hud-panel hud-corner p-4 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full mx-auto mb-3" />
          <div className="font-mono text-xs text-gray-500">正在建立数据通道...</div>
        </div>
      </div>
    );
  }

  const s = state.safetyIndicators;
  const o2Pct = state.oxygenFraction * 100;

  return (
    <div className="space-y-3">
      <GaugeCard
        label="OXYGEN FRACTION"
        value={`${o2Pct.toFixed(3)}`}
        unit="vol%"
        min={16}
        max={30}
        optimal={[19.5, 23.5]}
        current={o2Pct}
        status={s.o2Status}
        color="#06f0ff"
        icon="○₂"
      />

      <div className="grid grid-cols-2 gap-3">
        <GaugeCard
          label="CO₂ PPM"
          value={`${((state.partialPressureCO2 / state.absolutePressure) * 1_000_000).toFixed(0)}`}
          unit="ppm"
          min={0}
          max={8000}
          optimal={[400, 1000]}
          current={(state.partialPressureCO2 / state.absolutePressure) * 1_000_000}
          status={s.co2Status}
          color="#22d3ee"
          icon="c○₂"
        />
        <GaugeCard
          label="CABIN PRESSURE"
          value={`${state.absolutePressure.toFixed(2)}`}
          unit="kPa"
          min={70}
          max={130}
          optimal={[95, 108]}
          current={state.absolutePressure}
          status={s.pressureStatus}
          color="#a855f7"
          icon="▣"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SmallStat label="TEMPERATURE" value={`${state.temperature.toFixed(2)}°C`} accent="#fb923c" />
        <SmallStat label="HUMIDITY" value={`${state.humidity.toFixed(1)}%`} accent="#38bdf8" />
      </div>

      <div className="hud-panel hud-corner p-3">
        <div className="hud-title mb-2">
          <span className="status-indicator bg-neon-violet" style={{ background: '#b24bff' }} />
          代谢参数 METABOLIC
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-3 font-mono text-xs">
          <StatRow label="O₂ 消耗率" value={`${state.metabolicO2ConsumptionRate.toFixed(3)} L/h`} color="#06f0ff" />
          <StatRow label="CO₂ 产出率" value={`${state.metabolicCO2ProductionRate.toFixed(3)} L/h`} color="#22d3ee" />
          <StatRow label="呼吸商 RQ" value={state.respiratoryQuotient.toFixed(3)} color="#facc15" />
          <StatRow label="O₂ 储备" value={`${formatReserve(state.o2ReserveMinutes)}`} color={state.o2ReserveMinutes < 60 ? '#ef4444' : '#22c55e'} />
        </div>
      </div>

      <div className="hud-panel hud-corner p-3">
        <div className="hud-title mb-2">
          <span className="status-indicator" style={{ background: '#ff2d95' }} />
          舱内气体分压 PARTIAL PRESSURES
        </div>
        <PartialPressureBar label="O₂" value={state.partialPressureO2} total={state.absolutePressure} color="#06f0ff" />
        <PartialPressureBar label="N₂" value={state.partialPressureN2} total={state.absolutePressure} color="#64748b" />
        <PartialPressureBar label="CO₂" value={state.partialPressureCO2} total={state.absolutePressure} color="#22d3ee" />
        <PartialPressureBar label="H₂O(v)" value={estimateWVP(state.temperature, state.humidity)} total={state.absolutePressure} color="#38bdf8" />
      </div>
    </div>
  );
}

function formatReserve(min: number): string {
  if (min >= 99999) return '∞ FULL';
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${h}h ${m}min`;
}

function estimateWVP(tC: number, rh: number): number {
  const sat = 0.61078 * Math.exp((17.27 * tC) / (tC + 237.3));
  return sat * (rh / 100);
}

function GaugeCard(props: {
  label: string;
  value: string;
  unit: string;
  min: number;
  max: number;
  optimal: [number, number];
  current: number;
  status: SafetyIndicators['o2Status'];
  color: string;
  icon: string;
}) {
  const statusColor: Record<SafetyIndicators['o2Status'], string> = {
    normal: '#22c55e',
    warning: '#f59e0b',
    critical: '#f97316',
    fatal: '#ef4444',
  };
  const pos = ((props.current - props.min) / (props.max - props.min)) * 100;
  const optStart = ((props.optimal[0] - props.min) / (props.max - props.min)) * 100;
  const optEnd = ((props.optimal[1] - props.min) / (props.max - props.min)) * 100;

  return (
    <div className="hud-panel hud-corner p-3 relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="hud-title text-[10px] mb-1">{props.label}</div>
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono font-bold text-2xl tabular-nums"
              style={{ color: statusColor[props.status], textShadow: `0 0 10px ${statusColor[props.status]}60` }}
            >
              {props.value}
            </span>
            <span className="font-mono text-[11px] text-gray-500">{props.unit}</span>
          </div>
        </div>
        <div
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-sm"
          style={{
            border: `1px solid ${props.color}60`,
            background: `${props.color}10`,
            color: props.color,
            textShadow: `0 0 6px ${props.color}`,
          }}
        >
          {props.icon}
        </div>
      </div>

      <div className="relative h-2.5 bg-cabin-900/90 rounded overflow-hidden border border-cabin-600/50">
        <div
          className="absolute top-0 bottom-0 border-x-2 border-white/10"
          style={{
            left: `${optStart}%`,
            width: `${optEnd - optStart}%`,
            background: 'linear-gradient(90deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.4) 50%, rgba(34,197,94,0.15) 100%)',
          }}
        />
        <div
          className="absolute top-0 bottom-0 rounded-r transition-all duration-300"
          style={{
            width: `${Math.max(0, Math.min(100, pos))}%`,
            background: `linear-gradient(90deg, ${props.color}20, ${statusColor[props.status]})`,
            boxShadow: `0 0 10px ${statusColor[props.status]}80`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded"
          style={{
            left: `clamp(0%, ${pos}%, calc(100% - 4px))`,
            background: statusColor[props.status],
            boxShadow: `0 0 8px ${statusColor[props.status]}`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1 font-mono text-[9px] text-gray-600 tabular-nums">
        <span>{props.min}</span>
        <span>{props.optimal[0]}</span>
        <span>{props.optimal[1]}</span>
        <span>{props.max}</span>
      </div>
    </div>
  );
}

function SmallStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="hud-panel hud-corner px-3 py-2.5">
      <div className="hud-title text-[9px] mb-1" style={{ color: `${accent}b0` }}>{label}</div>
      <div
        className="font-mono font-bold text-lg tabular-nums"
        style={{ color: accent, textShadow: `0 0 8px ${accent}60` }}
      >
        {value}
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-right tabular-nums" style={{ color, textShadow: `0 0 4px ${color}60` }}>
        {value}
      </span>
    </>
  );
}

function PartialPressureBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  return (
    <div className="flex items-center gap-2 mb-1 last:mb-0">
      <span className="font-mono text-[10px] w-14 text-gray-400 tracking-wider">{label}</span>
      <div className="flex-1 h-1.5 bg-cabin-900 rounded overflow-hidden">
        <div
          className="h-full rounded-r"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}40, ${color})`,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
      <span className="font-mono text-[10px] w-14 text-right text-gray-400 tabular-nums">
        {value.toFixed(2)}kPa
      </span>
    </div>
  );
}
