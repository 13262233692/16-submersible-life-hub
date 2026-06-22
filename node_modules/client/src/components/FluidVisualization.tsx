import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FluidPseudoColorRenderer } from '../webgl/fluid-renderer';
import { buildTitaniumCabin } from '../webgl/cabin-geometry';
import { useLifeHubStore } from '../store/store';
import type { PaletteKey } from '../webgl/color-palettes';

export function FluidVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fluidCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FluidPseudoColorRenderer | null>(null);
  const threeSceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    group: THREE.Group;
  } | null>(null);
  const animRef = useRef<number>(0);
  const fpsCounterRef = useRef<{ frames: number; last: number }>({ frames: 0, last: performance.now() });
  const initializedRef = useRef(false);

  const displayMode = useLifeHubStore((s) => s.displayMode);
  const wireframe = useLifeHubStore((s) => s.wireframe);
  const grid = useLifeHubStore((s) => s.grid);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current || !fluidCanvasRef.current || !overlayCanvasRef.current) return;
    initializedRef.current = true;

    const GRID_W = 64;
    const GRID_H = 64;
    const cabin = buildTitaniumCabin(GRID_W, GRID_H);

    const fluidRenderer = new FluidPseudoColorRenderer(
      fluidCanvasRef.current,
      { width: GRID_W, height: GRID_H },
      cabin.maskData,
    );
    rendererRef.current = fluidRenderer;
    fluidRenderer.setPalette(displayMode as PaletteKey);

    const overlayCanvas = overlayCanvasRef.current;
    const threeRenderer = new THREE.WebGLRenderer({
      canvas: overlayCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
    camera.position.set(0, 0, 2.8);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0x2a3040, 0.8);
    scene.add(ambient);
    const rimLight = new THREE.DirectionalLight(0x06f0ff, 0.6);
    rimLight.position.set(-0.8, 0.6, 1.0);
    scene.add(rimLight);
    const warmLight = new THREE.DirectionalLight(0xffaa55, 0.35);
    warmLight.position.set(0.7, -0.5, 0.8);
    scene.add(warmLight);
    const topLight = new THREE.PointLight(0x3b82f6, 0.8, 4);
    topLight.position.set(0, 0.6, 0.8);
    scene.add(topLight);

    const group = new THREE.Group();
    group.add(cabin.hullMesh);
    group.add(cabin.hullInner);
    group.add(cabin.frameRings);
    group.add(cabin.portHoles);
    group.add(cabin.crewSeats);
    group.add(cabin.sensorNodes);
    scene.add(group);

    threeSceneRef.current = { scene, camera, renderer: threeRenderer, group };

    const resize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      fluidRenderer.setSize(w, h);
      threeRenderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    const loop = () => {
      const t = performance.now();
      const dt = (t - fpsCounterRef.current.last) / 1000;
      fpsCounterRef.current.frames++;
      if (dt >= 0.5) {
        const fps = Math.round(fpsCounterRef.current.frames / dt);
        useLifeHubStore.getState().setFps(fps);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.last = t;
      }

      group.rotation.y = Math.sin(t * 0.00015) * 0.05;
      group.rotation.x = Math.cos(t * 0.00012) * 0.03;

      cabin.sensorNodes.rotation.z = Math.sin(t * 0.001) * 0.02;
      cabin.sensorNodes.children.forEach((c, i) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
        const pulse = 0.6 + Math.sin(t * 0.004 + i) * 0.4;
        mat.opacity = pulse;
        mat.transparent = true;
      });

      fluidRenderer.render();
      threeRenderer.render(scene, camera);
      animRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      fluidRenderer.dispose();
      threeRenderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        const mat = (obj as THREE.Mesh).material;
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material).dispose();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setPalette(displayMode as PaletteKey);
    }
  }, [displayMode]);

  useEffect(() => {
    if (!threeSceneRef.current) return;
    threeSceneRef.current.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.material && 'wireframe' in m.material) {
        (m.material as Record<string, unknown>).wireframe = wireframe;
      }
    });
  }, [wireframe]);

  useEffect(() => {
    if (!grid || !rendererRef.current) return;
    const mode = displayMode as PaletteKey;
    if (mode === 'co2') {
      rendererRef.current.updateData(grid.co2Grid);
    } else {
      rendererRef.current.updateData(grid.o2Grid);
    }
    rendererRef.current.updateFlow(grid.flowVX, grid.flowVY);
  }, [grid, displayMode]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-lg scanline-effect"
      style={{ background: 'radial-gradient(ellipse at 50% 50%, #0a0e17 0%, #06080d 100%)' }}
    >
      <canvas
        ref={fluidCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'auto' }}
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <div className="absolute inset-0 crt-vignette pointer-events-none z-10" />
      <div className="absolute top-2 left-3 hud-corner px-4 py-3 pointer-events-none">
        <div className="hud-title">
          <span className="status-indicator bg-neon-green" />
          CROSS-SECTION · Ti-62A HULL
        </div>
        <div className="font-mono text-[10px] text-gray-400 mt-1 tracking-wider">
          GRID 64×64 · 4096 NODES · 3D CFD PSEUDO-COLOR
        </div>
      </div>
      <div className="absolute bottom-3 right-3 pointer-events-none">
        <div className="hud-panel hud-corner px-3 py-2 text-right">
          <div className="hud-title text-[10px] justify-end">FOV</div>
          <div className="font-mono text-[11px] text-gray-300">38° · DEPTH 10,909m</div>
        </div>
      </div>
    </div>
  );
}
