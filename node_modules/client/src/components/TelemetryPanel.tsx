import { useLifeHubStore } from '../store/store';

export function TelemetryPanel() {
  const telemetry = useLifeHubStore((s) => s.telemetry);
  const engine = telemetry?.engine;
  const ring = telemetry?.ringBuffer;
  const bw = telemetry?.bandwidthKBPushRate ?? 0;
  const clients = telemetry?.connectedClients ?? 0;
  const packets = telemetry?.totalPacketsSent ?? 0;

  return (
    <div className="hud-panel hud-corner p-3 space-y-2.5">
      <div className="hud-title">
        <span className="status-indicator" style={{ background: '#39ff14' }} />
        系统遥测 TELEMETRY
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        <TelemetryStat
          label="ENGINE LAT"
          value={`${engine?.avgLatencyMs?.toFixed(2) ?? '--'}ms`}
          ok={!!engine && engine.avgLatencyMs < 3}
          warn={!!engine && engine.avgLatencyMs > 10}
        />
        <TelemetryStat
          label="DROPPED"
          value={engine?.framesDropped?.toLocaleString() ?? '--'}
          ok={!!engine && engine.framesDropped < 10}
          warn={!!engine && engine.framesDropped > 100}
        />
        <TelemetryStat
          label="BUF UTIL"
          value={`${ring?.utilizationPercent?.toFixed(2) ?? '--'}%`}
          ok={!!ring && ring.utilizationPercent < 50}
          warn={!!ring && ring.utilizationPercent > 85}
        />
        <TelemetryStat
          label="COMPUTATIONS"
          value={engine?.totalComputations?.toLocaleString() ?? '--'}
        />
      </div>

      <div className="pt-2 border-t border-cabin-600/30 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-gray-500">WS 吞吐</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-cabin-900 rounded overflow-hidden">
              <div
                className="h-full bg-neon-cyan"
                style={{
                  width: `${Math.min(100, bw * 2)}%`,
                  boxShadow: '0 0 6px #06f0ff',
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-gray-300 tabular-nums w-14 text-right">
              {bw.toFixed(1)}KB/s
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-gray-500">连接客户端</span>
          <span className="text-neon-violet tabular-nums" style={{ color: '#b24bff' }}>
            {clients} CLIENT
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-gray-500">总推送包</span>
          <span className="text-neon-green tabular-nums" style={{ color: '#39ff14' }}>
            {packets.toLocaleString()} PKT
          </span>
        </div>
      </div>
    </div>
  );
}

function TelemetryStat({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const color = warn ? 'text-o2-low' : ok ? 'text-o2-safe' : 'text-gray-200';
  const glow = warn ? 'glow-text-red' : ok ? 'glow-text-green' : '';
  return (
    <div className="bg-cabin-900/50 border border-cabin-700/40 rounded px-2 py-1.5">
      <div className="text-[9px] text-gray-500 tracking-widest font-display">{label}</div>
      <div className={`font-bold tabular-nums ${color} ${glow}`}>{value}</div>
    </div>
  );
}
