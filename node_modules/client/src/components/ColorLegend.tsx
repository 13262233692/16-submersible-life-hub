import { useLifeHubStore } from '../store/store';
import { COLOR_PALETTES, PaletteKey } from '../webgl/color-palettes';

export function ColorLegend() {
  const mode = useLifeHubStore((s) => s.displayMode) as PaletteKey;
  const showLegend = useLifeHubStore((s) => s.showLegend);
  const setShowLegend = useLifeHubStore((s) => s.setShowLegend);
  const state = useLifeHubStore((s) => s.state);

  if (!showLegend) {
    return (
      <button
        onClick={() => setShowLegend(true)}
        className="hud-panel hud-corner px-3 py-1.5 text-xs font-display text-neon-cyan/80 hover:text-neon-cyan"
      >
        ◧ 图例
      </button>
    );
  }

  const palette = COLOR_PALETTES[mode];
  const gradientStr = palette.colors
    .map((c, i) => `#${c.getHexString()} ${(i / (palette.colors.length - 1)) * 100}%`)
    .join(', ');

  const domainValues = palette.domain.map((v) => v * palette.multiplier);

  let currentValueStr = '--';
  if (state) {
    if (mode === 'o2') currentValueStr = `${(state.oxygenFraction * 100).toFixed(2)} Vol%`;
    else if (mode === 'co2')
      currentValueStr = `${((state.partialPressureCO2 / state.absolutePressure) * 1_000_000).toFixed(0)} PPM`;
    else if (mode === 'flow') currentValueStr = `动态`;
    else currentValueStr = `${(state.safetyIndicators.overallStatus === 'normal' ? 0.35 : 0.7).toFixed(2)}`;
  }

  return (
    <div className="hud-panel hud-corner p-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="hud-title">
          <span className="status-indicator" style={{ background: '#ffbf00' }} />
          {palette.name}
        </div>
        <button
          onClick={() => setShowLegend(false)}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          ×
        </button>
      </div>

      <div className="relative">
        <div
          className="h-8 rounded-md border border-cabin-600/50 shadow-inner"
          style={{ background: `linear-gradient(90deg, ${gradientStr})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-black/30 pointer-events-none rounded-md" />
        </div>
        <div className="flex justify-between mt-1 font-mono text-[9px] text-gray-500 tabular-nums">
          {domainValues.map((v, i) => (
            <span key={i}>
              {v < 10 ? v.toFixed(3) : v < 100 ? v.toFixed(1) : v.toFixed(0)}
            </span>
          ))}
        </div>
        <div className="text-center mt-1 font-mono text-[10px] text-gray-400">
          单位: <span className="text-neon-cyan">{palette.unit}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-cabin-600/30">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-500">舱体均值</span>
            <span
              className="font-mono font-bold text-sm tabular-nums text-white"
              style={{ textShadow: '0 0 6px rgba(255,255,255,0.5)' }}
            >
              {currentValueStr}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
