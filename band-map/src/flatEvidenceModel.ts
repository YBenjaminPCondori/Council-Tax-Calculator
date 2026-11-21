import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Unitless so the drawing cannot be mistaken for a measured plan.
export const outline = [
  [-4.6, -2.0], [-1.1, -2.0], [-1.1, -2.9], [4.6, -2.9],
  [4.6, 2.9], [-4.6, 2.9],
] as const;

export function createEvidenceModel(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#09172b", 18, 36);
  const grid = new THREE.GridHelper(28, 28, "#375a7a", "#254361");
  grid.position.y = -0.11;
  scene.add(grid);
  scene.add(new THREE.HemisphereLight("#e9f4ff", "#3c557d", 2.1));
  const key = new THREE.DirectionalLight("#d8eeff", 2.3);
  key.position.set(-4, 11, 8);
  scene.add(key);

  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();

  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: "#c1d5e6", roughness: 0.88 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: "#dce6ef", roughness: 0.8 });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: "#b2e6ff" });
  for (const [index, a] of outline.entries()) {
    const b = outline[(index + 1) % outline.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const height = a[1] === 2.9 && b[1] === 2.9 ? 0.34 : 1.9;
    const x = (a[0] + b[0]) / 2;
    const z = (a[1] + b[1]) / 2;
    const yaw = -Math.atan2(dz, dx);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length + 0.1, height, 0.15), wallMaterial);
    wall.position.set(x, height / 2, z);
    wall.rotation.y = yaw;
    scene.add(wall);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length + 0.1, 0.027, 0.16), edgeMaterial);
    edge.position.set(x, height + 0.014, z);
    edge.rotation.y = yaw;
    scene.add(edge);
  }

  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minPolarAngle = 0.14;
  controls.maxPolarAngle = Math.PI / 2 - 0.10;
  controls.minZoom = 0.7;
  controls.maxZoom = 2.65;

  let frame = 0;
  const draw = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };

  function reset() {
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.position.set(10, 12.5, 13);
    controls.target.set(0, 0.45, 0);
    controls.update();
    draw();
  }

  controls.addEventListener("change", draw);
  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width < 1 || height < 1) return;
    const aspect = width / height;
    const halfHeight = Math.max(5.2, 6.1 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  });
  observer.observe(host);
  reset();

  return {
    reset,
    rotate(angle: number) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(camera.up, angle);
      camera.position.copy(controls.target).add(offset);
      controls.update();
      draw();
    },
    zoom(factor: number) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      if (frame) window.cancelAnimationFrame(frame);
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const surface = object.material;
          if (Array.isArray(surface)) surface.forEach(material => materials.add(material));
          else materials.add(surface);
        }
      });
      materials.forEach(material => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
