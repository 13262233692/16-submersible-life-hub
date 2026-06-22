import { useMemo, useState } from 'react';
import { useLifeHubStore } from '../store/store';
import { getBioSocket } from '../services/biosocket';
import type { AcuteCo2Alert } from '../types';

const severityBadge: Record<string, { label: string; cls: string }> = {
  warning: { label: 'WARNING', cls: 'bg-yellow-400 text-slate-900' },
  critical: { label: 'CRITICAL', cls: 'bg-orange-500 text-white' },
  fatal: { label: 'FATAL', cls: 'bg-red-600 text-white' },
  info: { label: 'INFO', cls: 'bg-sky-400 text-slate-900' },
};

function bar(value: number, min: number, max: number) {
  const clamped = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return `${(clamped * 100).toFixed(1)}%`;
}

function GradientMeter({
  label,
  value,
  unit,
  warn,
  crit,
}: {
  label: string;
  value: number;
  unit: string;
  warn: number;
  crit: number;
}) {
  const abs = Math.abs(value);
  const critical = abs >= crit;
  const warning = !critical && abs >= warn;
  const color = critical ? '#EF4444' : warning ? '#FACC15' : '#34D399';
  const width = bar(abs, 0, crit * 1.5);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="font-mono" style={{ color }}>
          {value >= 0 ? '+' : ''}
          {value.toFixed(3)} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  );
}

export function Co2DiagnosisModal() {
  const activeAlert: AcuteCo2Alert | null = useLifeHubStore((s) => s.activeAlert);
  const dismissAlert = useLifeHubStore((s) => s.dismissAlert);
  const acknowledgeAlert = useLifeHubStore((s) => s.acknowledgeAlert);
  const [sentAck, setSentAck] = useState(false);

  const gradientFields = useMemo(() => {
    if (!activeAlert) return null;
    const g = activeAlert.gradient;
    return [
      { label: '耗氧量微分量 (ΔO₂)', value: g.o2ConsumptionDelta, unit: 'mol/s', warn: 0.005, crit: 0.02 },
      { label: 'CO₂ 生成微分量 (ΔCO₂)', value: g.co2ProductionDelta, unit: 'mol/s', warn: 0.004, crit: 0.015 },
      { label: '脉率微分量 (ΔPulse)', value: g.pulseDelta, unit: 'BPM/s', warn: 3, crit: 10 },
      { label: 'SpO₂ 微分量 (ΔSpO₂)', value: g.spo2Delta, unit: '%/s', warn: 0.15, crit: 0.5 },
    ];
  }, [activeAlert]);

  if (!activeAlert) return null;

  const sev = severityBadge[activeAlert.severity] ?? severityBadge.warning;
  const timeToBreach = activeAlert.timeToBreachSec;
  const breachColor = timeToBreach < 120 ? '#EF4444' : timeToBreach < 240 ? '#FACC15' : '#34D399';

  const handleAcknowledge = () => {
    const sock = getBioSocket();
    if (sock && !sentAck) {
      sock.emit('alert:acknowledge' as any, { alertId: activeAlert.alertId });
      acknowledgeAlert(activeAlert.alertId);
      setSentAck(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl rounded-xl border-2 border-red-500/60 bg-slate-950/95 shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 80px 10px rgba(239, 68, 68, 0.35)' }}
      >
        <div className="relative px-6 py-4 bg-gradient-to-r from-red-700/40 via-yellow-600/30 to-red-700/40 border-b border-yellow-500/50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-yellow-300 tracking-wider">
                  急性 CO₂ 中毒 · 超前干预确诊报告
                </h2>
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${sev.cls}`}>
                  {sev.label}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                报告 ID: <span className="font-mono">{activeAlert.alertId}</span> · 触发潜水员 #
                <span className="font-mono">{activeAlert.triggeringDiverId}</span> ·{' '}
                {new Date(activeAlert.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">LSTM 滑窗推演 · CO₂ 分压预测</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">当前 / 临界 (bar)</span>
                  <span className="font-mono">
                    {activeAlert.lstmPrediction.predictedCo2Bar5Min.toFixed(4)} /{' '}
                    <span className="text-red-400">{activeAlert.co2CriticalBar.toFixed(3)}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">5 分钟预测</span>
                  <span className="font-mono text-red-400">
                    {activeAlert.lstmPrediction.predictedCo2Bar5Min.toFixed(4)} bar
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">10 分钟预测</span>
                  <span className="font-mono text-orange-400">
                    {activeAlert.lstmPrediction.predictedCo2Bar10Min.toFixed(4)} bar
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">5 分钟 O₂ 预测</span>
                  <span className="font-mono">
                    {activeAlert.lstmPrediction.predictedO2Kpa5Min.toFixed(2)} kPa
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">置信度</span>
                  <span className="font-mono text-sky-400">
                    {(activeAlert.lstmPrediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">代谢异常指数</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">距临界突破</span>
                  <span className="font-mono font-bold" style={{ color: breachColor }}>
                    {timeToBreach < 0 ? '已超限' : `${timeToBreach.toFixed(0)} 秒`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">非线性飙升指数 (η)</span>
                  <span
                    className="font-mono font-bold"
                    style={{
                      color:
                        activeAlert.lstmPrediction.nonlinearityIndex >= 2.2
                          ? '#EF4444'
                          : activeAlert.lstmPrediction.nonlinearityIndex >= 1.5
                            ? '#FACC15'
                            : '#34D399',
                    }}
                  >
                    {activeAlert.lstmPrediction.nonlinearityIndex.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">综合异常分 (ζ)</span>
                  <span
                    className="font-mono font-bold"
                    style={{
                      color:
                        activeAlert.lstmPrediction.anomalyScore >= 2.8
                          ? '#EF4444'
                          : activeAlert.lstmPrediction.anomalyScore >= 1.8
                            ? '#FACC15'
                            : '#34D399',
                    }}
                  >
                    {activeAlert.lstmPrediction.anomalyScore.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <p className="text-yellow-300 text-sm font-semibold leading-5">{activeAlert.title}</p>
                  <p className="text-slate-300 text-xs mt-1 leading-5">{activeAlert.message}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-3">
              代谢微分梯度 · {activeAlert ? `${activeAlert.gradient.windowSeconds}s 滑窗差分` : ''}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {gradientFields?.map((f) => (
                <GradientMeter key={f.label} {...f} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
              已注入生命维持总线的高优先级指令
            </div>
            <div className="flex flex-wrap gap-2">
              {activeAlert.interventionCommands.map((c, i) => (
                <span
                  key={i}
                  className="rounded border border-yellow-500/60 bg-yellow-500/10 px-2.5 py-1 font-mono text-xs text-yellow-300"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <button
            onClick={handleAcknowledge}
            disabled={activeAlert.acknowledged || sentAck}
            className="rounded-md bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-700 disabled:text-slate-500 px-5 py-2 text-sm font-bold text-slate-950 tracking-wider"
          >
            {activeAlert.acknowledged || sentAck ? '✓ 已签收确认' : '签收并确认干预指令'}
          </button>
          <button
            onClick={dismissAlert}
            disabled={!activeAlert.acknowledged && !sentAck}
            className="rounded-md border border-slate-700 hover:bg-slate-800 disabled:opacity-40 px-5 py-2 text-sm font-semibold text-slate-300 tracking-wider"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
