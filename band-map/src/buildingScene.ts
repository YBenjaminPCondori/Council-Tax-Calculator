import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bandColour, buildingGeometry, buildingIds, buildings, features, flatsForFloor } from "./data";
import type { BandData, Building, BuildingId, Point } from "./data";

const levelHeight = 3.22;
const parapetHeight = levelHeight * 4 + 0.25;
const tau = Math.PI * 2;

type Surface = THREE.MeshStandardMaterial;
type SetBox = (parent: THREE.Object3D, material: Surface, size: readonly [number, number, number], position: readonly [number, number, number]) => THREE.Mesh<THREE.BoxGeometry, Surface>;

function standard(colour: string, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness });
}

function brickMaterial(colour: string) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 256;
  const ctx = textureCanvas.getContext("2d");
  if (!ctx) return standard(colour);
  const base = [1, 3, 5].map(index => Number.parseInt(colour.slice(index, index + 2), 16));
  ctx.fillStyle = "#d8ccb9";
  ctx.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 18; row++) {
    for (let col = -1; col < 10; col++) {
      const variation = Math.sin((row + 3) * 27.05 + col * 15.454) * 13;
      const light = base.map(value => Math.min(255, Math.round(value + variation)));
      ctx.fillStyle = `rgb(${light.join(",")})`;
      ctx.fillRect(col * 64 + (row % 2) * 32, row * (256 / 18), 63, 13.3);
    }
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94 });
}

function boxFactory() {
  const cache = new Map<string, THREE.BoxGeometry>();
  const box: SetBox = (parent, material, size, position) => {
    const [width, height, depth] = size;
    const key = `${size.join("-")}/${!!material.map}`;
    let geo = cache.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(width, height, depth);
      if (material.map) {
        const uv = geo.getAttribute("uv");
        const faceSize = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
        for (let face = 0; face < 6; face++) {
          for (let corner = 0; corner < 4; corner++) {
            const index = face * 4 + corner;
            uv.setXY(index, uv.getX(index) * faceSize[face][0] / 1.76, uv.getY(index) * faceSize[face][1] / 1.35);
          }
        }
      }
      cache.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  return { box, cache };
}

function batch(group: THREE.Group) {
  const buckets = new Map<Surface, THREE.Mesh<THREE.BufferGeometry, Surface>[]>();
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const material = object.material;
    const instances = buckets.get(material) ?? [];
    instances.push(object);
    buckets.set(material, instances);
  });
  group.clear();
  for (const [material, instances] of buckets) {
    const parts = instances.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function roofWedge(width: number, depth: number, rise: number) {
  const profile = new THREE.Shape();
  profile.moveTo(-width / 2, 0);
  profile.lineTo(width / 2, 0);
  profile.lineTo(width * 0.36, rise);
  profile.closePath();
  const geometry = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeBuilding(building: Building, data: BandData, box: SetBox) {
  const { width, depth, centre, rotation } = buildingGeometry(building);
  const root = new THREE.Group();
  root.position.set(centre[0], 0, -centre[1]);
  root.rotation.y = rotation;

  const brick = brickMaterial(building.brick);
  const concrete = standard("#c5bba9");
  const coping = standard("#eee3d1");
  const roofBase = standard("#877b6b");
  const cladding = standard(building.roof, 0.72);
  const frame = standard("#38464a", 0.64);
  const recess = standard("#69594d");
  const glass = standard("#597985", 0.28);
  const darkGlass = standard("#4e635f", 0.36);
  const rail = standard("#424b48", 0.65);
  const zFront = depth / 2;
  const [westPier, eastPier] = building.pierWidths;
  const firstBay = -width / 2 + westPier;
  const bayWidth = (width - westPier - eastPier) / 7;
  const floors: THREE.Group[] = [];

  function windowAt(parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, door = false) {
    box(parent, frame, [w, h, 0.12], [x, y, z]);
    box(parent, door ? darkGlass : glass, [w - 0.13, h - 0.14, 0.07], [x, y, z + 0.073]);
    box(parent, frame, [0.05, h, 0.10], [x - w * 0.08, y, z + 0.11]);
    if (!door) box(parent, concrete, [w + 0.16, 0.055, 0.25], [x, y - h / 2, z + 0.03]);
  }

  for (let level = 0; level < 4; level++) {
    const floor = new THREE.Group();
    const y = level * levelHeight;
    const ground = level === 0;
    const loggia = level === 1 || level === 2;
    const sill = ground ? 0.2 : loggia ? 0.23 : 0.68;
    const lintel = ground ? 0.67 : 0.47;
    const opening = levelHeight - sill - lintel;
    const mid = y + sill + opening / 2;
    box(floor, brick, [width, sill, 0.5], [0, y + sill / 2, zFront - 0.23]);
    box(floor, brick, [width, lintel, 0.5], [0, y + levelHeight - lintel / 2, zFront - 0.23]);
    box(floor, brick, [width, levelHeight, 0.36], [0, y + levelHeight / 2, -zFront + 0.18]);
    box(floor, brick, [0.40, levelHeight, depth], [-width / 2 + 0.2, y + levelHeight / 2, 0]);
    box(floor, brick, [0.40, levelHeight, depth], [width / 2 - 0.2, y + levelHeight / 2, 0]);
    for (const sign of [-1, 1]) {
      const pierWidth = sign < 0 ? westPier : eastPier;
      const pierX = sign * (width / 2 - pierWidth / 2);
      box(floor, brick, [pierWidth, opening, 0.49], [pierX, mid, zFront - 0.24]);
      if (sign === (building.tallerEnd === "east" ? 1 : -1)) {
        windowAt(floor, pierX, mid, zFront + 0.015, 0.95, Math.min(1.72, opening - 0.18));
      }
      const sideOpening = new THREE.Group();
      sideOpening.position.set(sign * width / 2, mid, zFront * (sign < 0 ? 0.28 : 0.50));
      sideOpening.rotation.y = sign * Math.PI / 2;
      windowAt(sideOpening, 0, 0, 0.011, ground ? 0.86 : 1.14, ground ? 1.92 : 1.48, ground);
      floor.add(sideOpening);
    }
    for (let bay = 0; bay < 7; bay++) {
      const x = firstBay + bayWidth * (bay + 0.5);
      const offset = building.balconyShift + (bay === 0 ? 0.10 : 0);
      const recessWidth = loggia ? bayWidth * 0.49 : bayWidth * 0.27;
      const openingX = x + bayWidth * 0.17 + offset;
      const bayLeft = x - bayWidth / 2;
      const bayRight = x + bayWidth / 2;
      const openingLeft = openingX - recessWidth / 2;
      const openingRight = openingX + recessWidth / 2;
      box(floor, brick, [openingLeft - bayLeft, opening, 0.49], [(openingLeft + bayLeft) / 2, mid, zFront - 0.24]);
      box(floor, brick, [bayRight - openingRight + 0.015, opening, 0.49], [(bayRight + openingRight) / 2, mid, zFront - 0.24]);
      const inset = loggia ? 1.0 : 0.12;
      box(floor, recess, [recessWidth, opening, 0.18], [openingX, mid, zFront - inset]);
      windowAt(floor, openingX, mid, zFront - inset + 0.10, recessWidth * (loggia ? 0.80 : 0.93), opening - 0.16, ground);
      windowAt(floor, x - bayWidth * 0.25, mid + (ground ? 0.14 : 0), zFront + 0.01, 1.18, ground ? 1.67 : Math.min(opening - 0.12, 1.72));
      if (loggia) {
        box(floor, concrete, [recessWidth, 0.12, 1.05], [openingX, y + sill, zFront - 0.44]);
        box(floor, rail, [recessWidth, 0.06, 0.06], [openingX, y + sill + 0.91, zFront + 0.018]);
        for (let bar = 0; bar < 10; bar++) {
          box(floor, rail, [0.027, 0.88, 0.037], [openingLeft + 0.07 + bar * (recessWidth - 0.14) / 9, y + sill + 0.46, zFront + 0.018]);
        }
      }
      if (ground) {
        box(floor, coping, [recessWidth + 0.74, 0.16, 1.64], [openingX, 0.10, zFront + 0.76]);
        box(floor, concrete, [recessWidth + 0.84, 0.24, 0.82], [openingX, 2.68, zFront + 0.27]);
      }
    }
    batch(floor);
    floors.push(floor);
    root.add(floor);
  }

  const roof = new THREE.Group();
  box(roof, roofBase, [width, 0.20, depth], [0, parapetHeight - 0.15, 0]);
  box(roof, coping, [width, 0.30, 0.43], [0, parapetHeight - 0.02, zFront - 0.21]);
  box(roof, coping, [width, 0.30, 0.43], [0, parapetHeight - 0.02, -zFront + 0.21]);
  for (const sign of [-1, 1]) {
    box(roof, coping, [0.41, 0.31, depth], [sign * (width / 2 - 0.20), parapetHeight - 0.02, 0]);
  }
  const wedgeGeometry = roofWedge(bayWidth * 0.84, depth * 0.51, building.id === "woolspinners" ? 1.94 : 1.78);
  for (let bay = 0; bay < 7; bay++) {
    const wedge = new THREE.Mesh(wedgeGeometry, cladding);
    wedge.position.set(firstBay + bayWidth * (bay + 0.5), parapetHeight - 0.20, depth * 0.10);
    wedge.castShadow = true;
    roof.add(wedge);
  }
  batch(roof);
  wedgeGeometry.dispose();
  root.add(roof);

  const cutaway = new THREE.Group();
  const anchors = new Map<number, THREE.Vector3>();
  const flatMaterials = new Map<number, Surface>();
  const glowEdges = new Map<number, THREE.LineSegments>();
  const hitMeshes: THREE.Mesh[] = [];
  const visibleDepth = 4.6;
  const neutralRoom = "#b6bdb6";
  const innerWalls = standard("#d3cabb");
  const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const level of [2, 3] as const) {
    const y = level * levelHeight;
    const shell = new THREE.Group();
    box(shell, coping, [width, 0.22, depth], [0, y + 0.08, 0]);
    box(shell, brick, [width, 0.24, 0.55], [0, y + levelHeight - 0.13, zFront - 0.23]);
    box(shell, brick, [width, levelHeight, 0.36], [0, y + levelHeight / 2, -zFront + 0.18]);
    for (const side of [-1, 1]) {
      const end = side < 0 ? westPier : eastPier;
      const x = side * (width / 2 - end / 2);
      box(shell, brick, [0.36, levelHeight, depth], [side * (width / 2 - 0.18), y + levelHeight / 2, 0]);
      box(shell, brick, [end, levelHeight - 0.34, 0.48], [x, y + levelHeight / 2, zFront - 0.2]);
      if (side === (building.tallerEnd === "east" ? 1 : -1)) {
        windowAt(shell, x, y + levelHeight / 2, zFront + 0.045, 0.94, 1.7);
      }
    }
    for (const [index, flat] of flatsForFloor(level).entries()) {
      const x = firstBay + bayWidth * (index + 0.5);
      const roomWidth = bayWidth - 0.32;
      const midHeight = y + levelHeight / 2;
      const material = standard(neutralRoom, 0.88);
      flatMaterials.set(flat, material);
      box(cutaway, material, [roomWidth, 0.10, visibleDepth], [x, y + 0.23, zFront - visibleDepth / 2]);
      box(cutaway, material, [roomWidth, levelHeight - 0.45, 0.20], [x, midHeight, zFront - visibleDepth + 0.12]);
      if (index < 6) {
        box(shell, innerWalls, [0.27, levelHeight - 0.28, visibleDepth], [x + bayWidth / 2, midHeight, zFront - visibleDepth / 2]);
      }
      anchors.set(flat, new THREE.Vector3(x, midHeight, zFront + 0.18));

      const outline = new THREE.PlaneGeometry(roomWidth, levelHeight - 0.46);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(outline),
        new THREE.LineBasicMaterial({ color: bandColour(data[building.id][flat]), toneMapped: false }));
      outline.dispose();
      edge.position.set(x, midHeight, zFront + 0.028);
      edge.visible = false;
      glowEdges.set(flat, edge);
      cutaway.add(edge);

      const hit = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, levelHeight - 0.28), hitMaterial);
      hit.position.set(x, midHeight, zFront + 0.045);
      hit.userData.flat = flat;
      hitMeshes.push(hit);
      cutaway.add(hit);
    }
    batch(shell);
    cutaway.add(shell);
  }
  root.add(cutaway);

  function display(reveal: boolean, hovered: number | null) {
    floors.forEach((group, index) => { group.visible = !reveal || index < 2; });
    cutaway.visible = reveal;
    flatMaterials.forEach((material, flat) => {
      const band = data[building.id][flat];
      const lit = reveal && flat === hovered;
      const colour = bandColour(band);
      material.color.set(lit ? colour : neutralRoom);
      material.emissive.set(colour);
      material.emissiveIntensity = lit ? 0.7 : 0;
      glowEdges.get(flat)!.visible = lit;
    });
  }
  return { root, anchors, hitMeshes, centre, width, depth, display };
}

function materialPolygon(points: Point[], material: Surface, y: number) {
  const shape = new THREE.Shape();
  points.forEach(([x, north], index) => {
    if (index === 0) shape.moveTo(x, north);
    else shape.lineTo(x, north);
  });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

function makeLandscape(parent: THREE.Scene, box: SetBox) {
  const dirt = standard("#e1e3d9");
  const pavement = standard("#d9d4c6");
  const tarmac = standard("#b6c0bc");
  const grass = standard("#acbe9c");
  const bark = standard("#786956");
  const leaves = standard("#829b75");
  const shadeLeaves = standard("#68866b");
  const base = box(parent, dirt, [450, 0.35, 450], [0, -0.23, 0]);
  base.castShadow = false;
  for (const feature of features) {
    if (feature.kind === "green") parent.add(materialPolygon(feature.points, grass, -0.034));
    if (feature.kind !== "road" && feature.kind !== "mews" && feature.kind !== "path") continue;
    const roadWidth = feature.kind === "mews" ? 6 : feature.kind === "path" ? 1.45 : feature.name === "Gallions Road" ? 10.7 : 7.5;
    const material = feature.kind === "road" ? tarmac : pavement;
    feature.points.slice(1).forEach((b, index) => {
      const a = feature.points[index];
      const dx = b[0] - a[0];
      const dz = -b[1] + a[1];
      if (Math.hypot(dx, dz) < 0.2) return;
      const road = box(parent, material, [Math.hypot(dx, dz) + 0.4, 0.028, roadWidth], [(a[0] + b[0]) / 2, -0.015, -(a[1] + b[1]) / 2]);
      road.rotation.y = -Math.atan2(dz, dx);
      road.castShadow = false;
    });
  }
  const canopy = new THREE.IcosahedronGeometry(1, 1);
  const treePositions: Point[] = [
    [-41, -19], [-33, -13], [-23, -19], [-14, -14], [-5, -20], [1.5, -13],
    [16, -19], [26, -15], [37, -21], [47, -16], [55, -21], [-48, 6],
  ];
  treePositions.forEach(([x, north], index) => {
    const z = -north;
    box(parent, bark, [0.19, 2.35, 0.19], [x, 1.17, z]);
    const trunkHeight = index % 2 ? 3.0 : 2.8;
    for (let part = 0; part < 3; part++) {
      const crown = new THREE.Mesh(canopy, part === 0 ? shadeLeaves : leaves);
      crown.position.set(x + Math.cos(part * tau / 3) * 0.49, trunkHeight + part * 0.29, z + Math.sin(part * tau / 3) * 0.42);
      crown.scale.set(0.87 - part * 0.08, 1.01, 0.84);
      crown.castShadow = true;
      parent.add(crown);
    }
  });
}

interface SceneEvents {
  projectFlat: (flat: number, x: number, y: number, visible: boolean) => void;
  hoverFlat: (flat: number | null) => void;
  selectFlat: (flat: number) => void;
}

export function createBuildingScene(host: HTMLElement, data: BandData, events: SceneEvents) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e7efed");
  scene.fog = new THREE.Fog("#e7efed", 130, 290);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.30;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(39, 1, 0.3, 410);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minPolarAngle = 0.27;
  controls.maxPolarAngle = 1.46;
  controls.maxDistance = 164;
  controls.minDistance = 22;
  controls.zoomSpeed = 0.76;
  const { box, cache } = boxFactory();
  makeLandscape(scene, box);
  const models = {
    woolspinners: makeBuilding(buildings.woolspinners, data, box),
    softwood: makeBuilding(buildings.softwood, data, box),
  };
  buildingIds.forEach(id => scene.add(models[id].root));
  scene.add(new THREE.HemisphereLight("#fff7e6", "#758b85", 1.64));
  const sun = new THREE.DirectionalLight("#fff0d8", 2.12);
  sun.position.set(-52, 79, 50);
  sun.shadow.camera.left = -87;
  sun.shadow.camera.right = 87;
  sun.shadow.camera.top = 62;
  sun.shadow.camera.bottom = -85;
  sun.shadow.normalBias = 0.14;
  sun.shadow.mapSize.set(2048, 2048);
  sun.castShadow = true;
  scene.add(sun);

  let width = 1;
  let height = 1;
  let active: BuildingId = "woolspinners";
  let frame = 0;
  const projected = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press: { id: number; x: number; y: number } | null = null;

  function isFacingFront() {
    const model = models[active];
    return model.root.worldToLocal(eye.copy(camera.position)).z > model.depth / 2;
  }

  function pick(event: PointerEvent) {
    if (!isFacingFront()) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(pointer, camera);
    const flat: unknown = ray.intersectObjects(models[active].hitMeshes, false)[0]?.object.userData.flat;
    return typeof flat === "number" ? flat : null;
  }

  function onPointerMove(event: PointerEvent) {
    const flat = event.pointerType !== "touch" && event.buttons === 0 ? pick(event) : null;
    renderer.domElement.classList.toggle("model-pointer", flat !== null);
    events.hoverFlat(flat);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button === 0) press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent) {
    const start = press;
    press = null;
    if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const flat = pick(event);
    if (flat !== null) events.selectFlat(flat);
  }

  function clearHover() {
    renderer.domElement.classList.remove("model-pointer");
    events.hoverFlat(null);
  }

  function draw() {
    frame = 0;
    renderer.render(scene, camera);
    const model = models[active];
    const visible = isFacingFront();
    for (const [flat, anchor] of model.anchors) {
      model.root.localToWorld(projected.copy(anchor));
      projected.project(camera);
      events.projectFlat(flat, (projected.x + 1) * width / 2, (1 - projected.y) * height / 2, visible);
    }
  }

  function redraw() {
    if (!frame) frame = window.requestAnimationFrame(draw);
  }

  function reset() {
    const model = models[active];
    const [x, north] = model.centre;
    const targetY = 7.6;
    const targetZ = -north;
    const dist = Math.max(60, (model.width + 5.5) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    controls.target.set(x, targetY, targetZ);
    camera.position.set(x, targetY + dist * 0.19, targetZ + dist * 0.91);
    controls.maxDistance = Math.max(108, dist * 1.41);
    controls.update();
    redraw();
  }

  controls.addEventListener("change", redraw);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", clearHover);
  renderer.domElement.addEventListener("pointercancel", clearHover);
  const size = new ResizeObserver(([entry]) => {
    width = Math.max(1, entry.contentRect.width);
    height = Math.max(1, entry.contentRect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    reset();
  });
  size.observe(host);
  reset();

  return {
    show(next: BuildingId, hovered: number | null) {
      const reframe = next !== active;
      active = next;
      buildingIds.forEach(id => models[id].display(id === active, id === active ? hovered : null));
      if (reframe) reset();
      else redraw();
    },
    front() { reset(); },
    zoom(factor: number) {
      const delta = camera.position.clone().sub(controls.target);
      delta.setLength(THREE.MathUtils.clamp(delta.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(delta);
      controls.update();
      redraw();
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      size.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", clearHover);
      renderer.domElement.removeEventListener("pointercancel", clearHover);
      const geometries = new Set<THREE.BufferGeometry>();
      cache.forEach(geometry => geometries.add(geometry));
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
        geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach((material: THREE.Material) => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => {
        if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export type BuildingScene = ReturnType<typeof createBuildingScene>;
