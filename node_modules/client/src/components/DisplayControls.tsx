import { useLifeHubStore } from '../store/store';
import type { DisplayMode } from '../types';
import { COLOR_PALETTES } from '../webgl/color-palettes';

export function DisplayControls() {
  const displayMode = useLifeHubStore((s) => s.displayMode);
  const setDisplayMode = useLifeHubStore((s) => s.setDisplayMode);
  const wireframe = useLifeHubStore((s) => s.wireframe);
  const setWireframe = useLifeHubStore((s) => s.setWireframe);

  const modes: Array<{ key: DisplayMode; label: string; hint: string }> = [
    { key: 'o2', label: 'O₂ 分布', hint: '氧气浓度梯度' },
    { key: 'co2', label: 'CO₂ 分布', hint: '二氧化碳浓度' },
    { key: 'flow', label: '流速场', hint: '气流强度分布' },
    { key: 'combined', label: '融合视图', hint: '综合危险指数' },
  ];

  return (
    <div className="hud-panel hud-corner p-3 space-y-3">
      <div>
        <div className="hud-title mb-2">
          <span className="status-indicator" style={{ background: '#06f0ff' }} />
          可视化模式 RENDER MODE
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {modes.map((m) => {
            const active = displayMode === m.key;
            const palette = COLOR_PALETTES[m.key];
            const gradientColors = palette.colors
              .map((c) => `#${c.getHexString()}`)
              .join(', ');
            return (
              <button
                key={m.key}
                onClick={() => setDisplayMode(m.key)}
                className={`relative p-2 rounded border text-left transition-all ${
                  active
                    ? 'border-neon-cyan/60 bg-neon-cyan/10 shadow-[0_0_12px_rgba(6,240,255,0.2)]'
                    : 'border-cabin-600/40 bg-cabin-800/50 hover:border-cabin-500/60 hover:bg-cabin-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-display text-[11px] tracking-wider ${active ? 'text-neon-cyan' : 'text-gray-300'}`}>
                    {m.label}
                  </span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_6px_#06f0ff]" />}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden opacity-80"
                  style={{ background: `linear-gradient(90deg, ${gradientColors})` }} />
                <div className="font-mono text-[9px] text-gray-500 mt-1">{m.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-cabin-600/30">
        <span className="font-mono text-[11px] text-gray-400">线框模式 WIREFRAME</span>
        <button
          onClick={() => setWireframe(!wireframe)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            wireframe ? 'bg-neon-cyan/40' : 'bg-cabin-700'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              wireframe ? 'left-[22px] bg-neon-cyan shadow-[0_0_6px_#06f0ff]' : 'left-0.5 bg-gray-400'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
