import * as THREE from 'three';
import { buildColorLut, PaletteKey } from './color-palettes';

const VERT_SHADER = /* glsl */ `
  attribute vec2 a_position;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SHADER = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_dataTex;
  uniform sampler2D u_lutTex;
  uniform sampler2D u_maskTex;
  uniform float u_domainMin;
  uniform float u_domainMax;
  uniform float u_intensity;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_mode;
  uniform vec2 u_flowScale;
  uniform sampler2D u_vxTex;
  uniform sampler2D u_vyTex;

  // 柏林噪声
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i);
    float b = hash(i + vec2(1.0,0.0));
    float c = hash(i + vec2(0.0,1.0));
    float d = hash(i + vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }

  void main() {
    // 舱体掩膜
    float mask = texture2D(u_maskTex, v_uv).r;
    if (mask < 0.5) {
      // 外部渲染金属边缘效果
      float edgeDist = length(v_uv - 0.5) * 2.0;
      float rim = smoothstep(1.05, 0.95, edgeDist);
      vec3 bg = mix(vec3(0.025,0.03,0.05), vec3(0.08,0.1,0.15), rim);
      bg += vec3(0.01) * noise(v_uv * 80.0 + u_time*0.1);
      gl_FragColor = vec4(bg, 1.0);
      return;
    }

    // 主数据采样
    vec2 uv = v_uv;
    float rawValue = texture2D(u_dataTex, uv).r;

    // 流速扰动模拟（光线折射）
    float vx = (texture2D(u_vxTex, uv).r - 0.5) * 2.0 * u_flowScale.x;
    float vy = (texture2D(u_vyTex, uv).r - 0.5) * 2.0 * u_flowScale.y;
    vec2 flowOffset = vec2(vx, vy) * 0.02;
    float rippled = texture2D(u_dataTex, uv + flowOffset).r;
    rawValue = mix(rawValue, rippled, 0.5);

    // 模式混合逻辑
    // u_mode 0 = O2, 1 = CO2, 2 = FLOW, 3 = COMBINED
    float normalized = 0.0;
    if (u_mode < 2.5) {
      normalized = clamp((rawValue - u_domainMin) / (u_domainMax - u_domainMin), 0.0, 1.0);
    } else {
      // COMBINED: 从数据纹理 r=O2, 用邻近采样 CO2
      float o2n = clamp((rawValue - 0.16) / (0.30 - 0.16), 0.0, 1.0);
      // 在 R 通道打包 O2，这里用基于位置的 CO2 近似（真实实现应该用多纹理）
      float co2Approx = 1.0 - smoothstep(0.0, 1.0, noise(v_uv*12.0 + u_time*0.02));
      float hazard = (1.0 - o2n) * 0.6 + co2Approx * 0.4;
      normalized = clamp(hazard, 0.0, 1.0);
    }

    // LUT 颜色查找
    vec4 color = texture2D(u_lutTex, vec2(normalized, 0.5));

    // 3D 体积渲染感：添加深度相关雾化和等值线
    float depth = smoothstep(0.0, 0.3, mask) * 0.5 + 0.5;
    float isoLine1 = abs(fract(normalized * 10.0 + 0.5) - 0.5);
    isoLine1 = smoothstep(0.48, 0.5, isoLine1);

    float isoLine2 = abs(fract(normalized * 4.0 + 0.5) - 0.5);
    isoLine2 = smoothstep(0.46, 0.5, isoLine2) * 0.6;

    vec3 isoColor = vec3(1.0) * isoLine1 * 0.3 + color.rgb * isoLine2;

    // 增强亮度：应用伪彩图辉光
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 bloom = color.rgb * smoothstep(0.3, 1.0, normalized) * 0.8;
    color.rgb += bloom;

    // 添加舱体内部深度阴影（椭圆中心-边缘）
    vec2 centered = (v_uv - 0.5) * 2.0;
    centered.x *= 1.0 / 0.84; // 匹配椭圆 rx/ry
    float ellipse = dot(centered, centered);
    float edgeShade = 1.0 - smoothstep(0.75, 1.0, ellipse) * 0.55;
    float vignette = 1.0 - smoothstep(0.6, 1.05, ellipse) * 0.4;

    color.rgb *= edgeShade;
    color.rgb += isoColor;

    // 扫描线（CRT 拟真）
    float scan = 0.97 + 0.03 * sin(v_uv.y * u_resolution.y * 1.2 + u_time * 3.0);
    color.rgb *= scan;
    color.rgb *= vignette;

    // 强度缩放
    color.rgb = mix(vec3(0.04,0.05,0.07), color.rgb, u_intensity);
    color.rgb += 0.01 * noise(v_uv * 180.0 + u_time * 0.5);

    gl_FragColor = vec4(color.rgb, 1.0);
  }
`;

export interface FluidRendererConfig {
  width: number;
  height: number;
}

export class FluidPseudoColorRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private dataTexture: THREE.DataTexture;
  private lutTexture: THREE.DataTexture;
  private maskTexture: THREE.DataTexture;
  private vxTexture: THREE.DataTexture;
  private vyTexture: THREE.DataTexture;
  private _paletteKey: PaletteKey = 'o2';
  private _intensity: number = 1.0;
  private width: number;
  private height: number;
  private startTime: number;

  constructor(canvas: HTMLCanvasElement, config: FluidRendererConfig, maskData: Uint8Array) {
    this.width = config.width;
    this.height = config.height;
    this.startTime = performance.now();

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x06080d, 1);

    this.dataTexture = this.makeFloatTexture(0.0, this.width, this.height);
    this.vxTexture = this.makeFloatTexture(0.5, this.width, this.height);
    this.vyTexture = this.makeFloatTexture(0.5, this.width, this.height);
    this.vxTexture.type = THREE.HalfFloatType;
    this.vyTexture.type = THREE.HalfFloatType;
    this.maskTexture = new THREE.DataTexture(
      maskData.slice() as any,
      this.width,
      this.height,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.magFilter = THREE.LinearFilter;
    this.maskTexture.needsUpdate = true;

    this.lutTexture = this.makeLutTexture(this._paletteKey);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT_SHADER,
      fragmentShader: FRAG_SHADER,
      uniforms: {
        u_dataTex: { value: this.dataTexture },
        u_lutTex: { value: this.lutTexture },
        u_maskTex: { value: this.maskTexture },
        u_domainMin: { value: 0.16 },
        u_domainMax: { value: 0.30 },
        u_intensity: { value: 1.0 },
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
        u_mode: { value: 0.0 },
        u_flowScale: { value: new THREE.Vector2(1, 1) },
        u_vxTex: { value: this.vxTexture },
        u_vyTex: { value: this.vyTexture },
      },
    });

    const quadGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      -1, -1,   1, -1,  -1,  1,
       1, -1,   1,  1,  -1,  1,
    ]);
    const uvs = new Float32Array([
      0, 0,  1, 0,  0, 1,
      1, 0,  1, 1,  0, 1,
    ]);
    quadGeo.setAttribute('a_position', new THREE.BufferAttribute(positions, 2));
    quadGeo.setAttribute('a_uv', new THREE.BufferAttribute(uvs, 2));

    this.mesh = new THREE.Mesh(quadGeo, this.material);
    this.scene.add(this.mesh);
  }

  setSize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.material.uniforms.u_resolution.value.set(w, h);
  }

  setPalette(key: PaletteKey) {
    this._paletteKey = key;
    const lut = buildColorLut(key, 1024);
    const lutData = new Uint8Array(1024 * 4);
    for (let i = 0; i < 1024; i++) {
      lutData[i * 4] = Math.min(255, Math.max(0, Math.round(lut.lut[i * 4] * 255)));
      lutData[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(lut.lut[i * 4 + 1] * 255)));
      lutData[i * 4 + 2] = Math.min(255, Math.max(0, Math.round(lut.lut[i * 4 + 2] * 255)));
      lutData[i * 4 + 3] = 255;
    }
    this.lutTexture.dispose();
    this.lutTexture = new THREE.DataTexture(
      lutData.slice() as any,
      1024,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    this.lutTexture.minFilter = THREE.LinearFilter;
    this.lutTexture.magFilter = THREE.LinearFilter;
    this.lutTexture.needsUpdate = true;
    this.material.uniforms.u_lutTex.value = this.lutTexture;

    const domain = lut.palette.domain;
    this.material.uniforms.u_domainMin.value = domain[0];
    this.material.uniforms.u_domainMax.value = domain[domain.length - 1];

    const modeMap: Record<PaletteKey, number> = {
      o2: 0,
      co2: 1,
      flow: 2,
      combined: 3,
    };
    this.material.uniforms.u_mode.value = modeMap[key];
  }

  setIntensity(v: number) { this._intensity = v; this.material.uniforms.u_intensity.value = v; }

  updateData(grid: Float32Array | number[]) {
    const data = this.dataTexture.image.data as unknown as Float32Array;
    const n = Math.min(grid.length, data.length);
    for (let i = 0; i < n; i++) data[i] = grid[i];
    this.dataTexture.needsUpdate = true;
  }

  updateFlow(vx: Float32Array | number[], vy: Float32Array | number[]) {
    const dx = this.vxTexture.image.data as unknown as Float32Array;
    const dy = this.vyTexture.image.data as unknown as Float32Array;
    const n = Math.min(vx.length, dx.length);
    let maxVx = 0, maxVy = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(vx[i]) > maxVx) maxVx = Math.abs(vx[i]);
      if (Math.abs(vy[i]) > maxVy) maxVy = Math.abs(vy[i]);
    }
    const scale = 1 / Math.max(1e-6, Math.max(maxVx, maxVy));
    for (let i = 0; i < n; i++) {
      dx[i] = 0.5 + vx[i] * scale * 0.5;
      dy[i] = 0.5 + vy[i] * scale * 0.5;
    }
    this.material.uniforms.u_flowScale.value.set(maxVx * 100, maxVy * 100);
    this.vxTexture.needsUpdate = true;
    this.vyTexture.needsUpdate = true;
  }

  render() {
    this.material.uniforms.u_time.value = (performance.now() - this.startTime) / 1000;
    this.renderer.render(this.scene, this.camera);
  }

  getDomElement(): HTMLCanvasElement { return this.renderer.domElement; }
  getPaletteKey(): PaletteKey { return this._paletteKey; }

  dispose() {
    this.dataTexture.dispose();
    this.lutTexture.dispose();
    this.maskTexture.dispose();
    this.vxTexture.dispose();
    this.vyTexture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.renderer.dispose();
  }

  private makeFloatTexture(init: number, w: number, h: number): THREE.DataTexture {
    const data = new Float32Array(w * h);
    data.fill(init);
    const tex = new THREE.DataTexture(
      data,
      w,
      h,
      THREE.RedFormat,
      THREE.FloatType,
    );
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private makeLutTexture(key: PaletteKey): THREE.DataTexture {
    const { lut } = buildColorLut(key, 1024);
    const data = new Uint8Array(1024 * 4);
    for (let i = 0; i < 1024; i++) {
      data[i * 4] = Math.min(255, Math.round(lut[i * 4] * 255));
      data[i * 4 + 1] = Math.min(255, Math.round(lut[i * 4 + 1] * 255));
      data[i * 4 + 2] = Math.min(255, Math.round(lut[i * 4 + 2] * 255));
      data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data.slice() as any, 1024, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
}
