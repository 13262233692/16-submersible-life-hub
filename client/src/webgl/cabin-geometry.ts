import * as THREE from 'three';

export interface CabinGeometryData {
  hullMesh: THREE.Mesh;
  hullInner: THREE.Mesh;
  frameRings: THREE.LineSegments;
  portHoles: THREE.Group;
  crewSeats: THREE.Group;
  sensorNodes: THREE.Group;
  maskTexture: THREE.DataTexture;
  maskData: Uint8Array;
  width: number;
  height: number;
}

export function buildTitaniumCabin(width: number, height: number): CabinGeometryData {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.42;
  const ry = height * 0.36;

  const maskData = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      maskData[y * width + x] = nx * nx + ny * ny <= 1.0 ? 1 : 0;
    }
  }

  const maskTexture = new THREE.DataTexture(
    maskData,
    width,
    height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  maskTexture.needsUpdate = true;
  maskTexture.minFilter = THREE.LinearFilter;
  maskTexture.magFilter = THREE.LinearFilter;

  const hullShape = new THREE.Shape();
  const seg = 128;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) hullShape.moveTo(x, y);
    else hullShape.lineTo(x, y);
  }

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 40,
    bevelEnabled: true,
    bevelThickness: 3.5,
    bevelSize: 3,
    bevelSegments: 8,
    curveSegments: 32,
  });
  hullGeo.center();
  hullGeo.rotateX(Math.PI);
  hullGeo.scale(0.03, 0.03, 0.03);

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a3f47,
    metalness: 0.93,
    roughness: 0.25,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    reflectivity: 0.8,
    sheen: 0.1,
    sheenColor: 0x5a6472,
  });
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.position.z = -0.2;

  const innerGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 38,
    bevelEnabled: false,
    curveSegments: 32,
  });
  innerGeo.center();
  innerGeo.rotateX(Math.PI);
  innerGeo.scale(0.03, 0.03, 0.03);

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x101825,
    metalness: 0.1,
    roughness: 0.9,
    emissive: 0x0a0e17,
    emissiveIntensity: 0.15,
    side: THREE.BackSide,
  });
  const hullInner = new THREE.Mesh(innerGeo, innerMat);
  hullInner.position.z = -0.1;

  const ringsPoints: THREE.Vector3[] = [];
  for (let r = 0; r < 3; r++) {
    const f = 0.94 - r * 0.09;
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const x = Math.cos(a) * (rx * 0.03) * f;
      const y = Math.sin(a) * (ry * 0.03) * f;
      ringsPoints.push(new THREE.Vector3(x, y, -0.01));
      const a2 = ((i + 0.1) / 96) * Math.PI * 2;
      const x2 = Math.cos(a2) * (rx * 0.03) * f;
      const y2 = Math.sin(a2) * (ry * 0.03) * f;
      ringsPoints.push(new THREE.Vector3(x2, y2, -0.01));
    }
  }
  const frameRings = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(ringsPoints),
    new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.4 }),
  );

  const portHoles = new THREE.Group();
  const portPositions: Array<[number, number, number]> = [
    [-(rx * 0.03) * 0.7, (ry * 0.03) * 0.15, 0.0],
    [(rx * 0.03) * 0.7, (ry * 0.03) * 0.15, 0.0],
  ];
  for (const [px, py, pz] of portPositions) {
    const port = new THREE.Mesh(
      new THREE.CircleGeometry(0.07, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x1a2538,
        metalness: 0.5,
        roughness: 0.1,
        transmission: 0.7,
        thickness: 0.1,
        transparent: true,
        opacity: 0.85,
      }),
    );
    port.position.set(px, py, pz);
    const portFrame = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.085, 32),
      new THREE.MeshStandardMaterial({ color: 0x8b93a1, metalness: 0.9, roughness: 0.2 }),
    );
    portFrame.position.set(px, py, pz + 0.001);
    portHoles.add(port, portFrame);
  }

  const crewSeats = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 }),
    );
    seat.position.set(i * 0.22, -(ry * 0.03) * 0.55, 0.0);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.8 }),
    );
    back.position.set(i * 0.22, -(ry * 0.03) * 0.48, -0.06);
    crewSeats.add(seat, back);
  }

  const sensorNodes = new THREE.Group();
  const sensors: Array<[number, number, number, number]> = [
    [-(rx * 0.03) * 0.6, (ry * 0.03) * 0.7, 0.0, 0x10b981],
    [(rx * 0.03) * 0.6, (ry * 0.03) * 0.7, 0.0, 0x06b6d4],
    [0, (ry * 0.03) * 0.85, 0.0, 0xa855f7],
  ];
  for (const [sx, sy, sz, color] of sensors) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 16, 16),
      new THREE.MeshBasicMaterial({ color }),
    );
    s.position.set(sx, sy, sz);
    sensorNodes.add(s);
  }

  return {
    hullMesh,
    hullInner,
    frameRings,
    portHoles,
    crewSeats,
    sensorNodes,
    maskTexture,
    maskData,
    width,
    height,
  };
}
