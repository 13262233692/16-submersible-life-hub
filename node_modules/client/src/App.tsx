import { useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { ConnectionBadge } from './components/ConnectionBadge';
import { FluidVisualization } from './components/FluidVisualization';
import { BiochemicalGauges } from './components/BiochemicalGauges';
import { DisplayControls } from './components/DisplayControls';
import { GasControlPanel } from './components/GasControlPanel';
import { ColorLegend } from './components/ColorLegend';
import { TelemetryPanel } from './components/TelemetryPanel';
import { LifeSupportAlertBorder } from './components/LifeSupportAlertBorder';
import { Co2DiagnosisModal } from './components/Co2DiagnosisModal';
import { createBioSocket } from './services/biosocket';

export default function App() {
  useEffect(() => {
    const socket = createBioSocket();
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-2.5 p-3 text-white relative">
      <LifeSupportAlertBorder />
      <Co2DiagnosisModal />
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-4 mb-2">
          <TopHeader />
        </div>
        <div className="flex items-center justify-between px-1">
          <ConnectionBadge />
          <div className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
            <span>◉ 奋斗者号 · 马里亚纳海沟 · 挑战者深渊</span>
            <span className="text-neon-cyan">DEPTH 10,909mBSL</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0">
        <div className="col-span-3 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
          <BiochemicalGauges />
        </div>

        <div className="col-span-6 flex flex-col gap-2.5 min-h-0">
          <div className="flex-1 min-h-0">
            <FluidVisualization />
          </div>
          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            <ColorLegend />
            <TelemetryPanel />
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-1">
          <DisplayControls />
          <GasControlPanel />
          <div className="hud-panel hud-corner p-3 space-y-2">
            <div className="hud-title">
              <span className="status-indicator" style={{ background: '#818cf8' }} />
              任务信息 MISSION
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <MissionRow k="潜器编号" v="FZ-2024-1103" accent="#06f0ff" />
              <MissionRow k="舱体材料" v="Ti-62A 钛合金" accent="#818cf8" />
              <MissionRow k="舱内容积" v="14,500 L" accent="#a855f7" />
              <MissionRow k="额定载员" v="3 人" accent="#c084fc" />
              <MissionRow k="设计潜深" v="11,000 m" accent="#22c55e" />
              <MissionRow k="当前深度" v="10,909 m" accent="#06f0ff" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionRow({ k, v, accent }: { k: string; v: string; accent: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{k}</span>
      <span className="tabular-nums" style={{ color: accent, textShadow: `0 0 4px ${accent}60` }}>
        {v}
      </span>
    </div>
  );
}
