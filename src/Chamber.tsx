import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NeuralState, SourceKind, WorldSource, WorldState } from "./types";
import { SOURCE_INFO } from "./environment";

interface Props {
  world: MutableRefObject<WorldState>;
  neural: MutableRefObject<NeuralState>;
  onPlace: (kind: SourceKind, x: number, z: number) => void;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, z: number) => void;
  onError: (error: string) => void;
}
export default function Chamber({
  world,
  neural,
  onPlace,
  onSelect,
  onMove,
  onError,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      onError(
        "This scene needs WebGL. Enable hardware acceleration or use a recent desktop browser.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute(
      "aria-label",
      "3D fly chamber. Pick a sensory source and click to place. Drag placed objects to move them; right-drag to orbit.",
    );
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x111c19, 0.026);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(9.5, 8, 11.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.1, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.mouseButtons = {
      LEFT: undefined,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    scene.add(new THREE.AmbientLight(0xbed8d0, 1.8));
    const key = new THREE.DirectionalLight(0xe3ffe1, 4);
    key.position.set(-4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -8,
      right: 8,
      top: 8,
      bottom: -8,
    });
    scene.add(key);
    const fill = new THREE.PointLight(0xafb7ff, 35, 20);
    fill.position.set(4, 4, -3);
    scene.add(fill);
    const rim = new THREE.PointLight(0xbbef9a, 25, 15);
    rim.position.set(-4, 4, -2);
    scene.add(rim);

    const metal = new THREE.MeshStandardMaterial({
      color: 0x293732,
      metalness: 0.65,
      roughness: 0.4,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x26352d,
      metalness: 0.2,
      roughness: 0.9,
    });
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(5.4, 5.6, 0.3, 96),
      metal,
    );
    base.position.y = -0.2;
    base.receiveShadow = true;
    scene.add(base);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5.35, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.Group();
    scene.add(grid);
    const lines: number[] = [];
    for (let x = -5; x <= 5; x += 0.5) {
      const end = Math.sqrt(5.25 ** 2 - x * x);
      lines.push(x, 0, -end, x, 0, end, -end, 0, x, end, 0, x);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(lines, 3),
    );
    grid.add(
      new THREE.LineSegments(
        gridGeometry,
        new THREE.LineBasicMaterial({
          color: 0x6f8b76,
          transparent: true,
          opacity: 0.22,
        }),
      ),
    );
    function ring(
      radius: number,
      y: number,
      color: number,
      opacity: number,
      thick = 0.012,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, thick, 6, 128),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = y;
      scene.add(mesh);
      return mesh;
    }
    ring(5.36, 0.015, 0xccebad, 0.7, 0.025);
    ring(5.4, -0.28, 0x9dbca5, 0.2);
    ring(5.36, 4.9, 0x9fcbb2, 0.3);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * 5.36, 0, Math.sin(a) * 5.36),
        new THREE.Vector3(Math.cos(a) * 5.36, 4.9, Math.sin(a) * 5.36),
      ]);
      scene.add(
        new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({
            color: 0x95b1a0,
            transparent: true,
            opacity: 0.13,
          }),
        ),
      );
    }
    // Sparse cylinder edges suggest a glass chamber while preserving visibility of the specimen.
    const glassGeo = new THREE.CylinderGeometry(5.36, 5.36, 4.9, 64, 1, true);
    const glass = new THREE.Mesh(
      glassGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x9bbfa9,
        transparent: true,
        opacity: 0.035,
        roughness: 0.2,
        metalness: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    glass.position.y = 2.45;
    scene.add(glass);

    const fly = new THREE.Group();
    scene.add(fly);
    const shell = new THREE.MeshStandardMaterial({
      color: 0x6f7a48,
      metalness: 0.48,
      roughness: 0.5,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x222d23,
      metalness: 0.4,
      roughness: 0.5,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x922f29,
      metalness: 0.35,
      roughness: 0.35,
    });
    function ellipsoid(
      parent: THREE.Group,
      pos: number[],
      scale: number[],
      material: THREE.Material,
    ) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        material,
      );
      mesh.position.set(...(pos as [number, number, number]));
      mesh.scale.set(...(scale as [number, number, number]));
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    }
    ellipsoid(fly, [0, 0, -0.35], [0.28, 0.27, 0.55], shell);
    ellipsoid(fly, [0, 0.04, 0.15], [0.31, 0.31, 0.34], dark);
    ellipsoid(fly, [0, 0.11, 0.57], [0.27, 0.25, 0.23], shell);
    ellipsoid(fly, [-0.21, 0.15, 0.65], [0.135, 0.18, 0.14], eyeMat);
    ellipsoid(fly, [0.21, 0.15, 0.65], [0.135, 0.18, 0.14], eyeMat);
    // Fine abdomen bands and articulated legs make the fly readable at the chamber scale.
    for (let i = 0; i < 4; i++) {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.23 - i * 0.022, 0.025, 5, 24),
        dark,
      );
      stripe.position.set(0, 0, -0.25 - i * 0.15);
      stripe.scale.y = 0.9;
      fly.add(stripe);
    }
    function segment(a: THREE.Vector3, b: THREE.Vector3, width: number) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.7, width, a.distanceTo(b), 6),
        dark,
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        b.clone().sub(a).normalize(),
      );
      fly.add(mesh);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = 0.28 - i * 0.25;
        const a = new THREE.Vector3(side * 0.19, -0.12, z),
          b = new THREE.Vector3(side * 0.47, -0.32, z + 0.18 - i * 0.16),
          c = new THREE.Vector3(side * 0.58, -0.5, z + 0.32 - i * 0.26);
        segment(a, b, 0.024);
        segment(b, c, 0.015);
      }
      segment(
        new THREE.Vector3(side * 0.1, 0.21, 0.7),
        new THREE.Vector3(side * 0.17, 0.34, 0.85),
        0.014,
      );
    }
    const wings: THREE.Group[] = [];
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4e5df,
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 0.23, 0.05);
      fly.add(pivot);
      const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12), wingMat);
      wing.scale.set(0.85, 0.018, 0.31);
      wing.position.set(side * 0.7, 0.02, -0.25);
      wing.rotation.y = side * 0.35;
      pivot.add(wing);
      for (let i = 0; i < 3; i++) {
        const vein = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(side * (1.2 - i * 0.15), 0.025, -0.3 + i * 0.14),
        ]);
        pivot.add(
          new THREE.Line(
            vein,
            new THREE.LineBasicMaterial({
              color: 0x8ca69c,
              transparent: true,
              opacity: 0.35,
            }),
          ),
        );
      }
      wings.push(pivot);
    }
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.565, 64),
      new THREE.MeshBasicMaterial({
        color: 0xcfeeac,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    scene.add(halo);
    const sourceMeshes = new Map<string, THREE.Group>();
    const disposeObject = (object: THREE.Object3D) => {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material)
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]) {
            (material as THREE.MeshStandardMaterial).map?.dispose();
            material.dispose();
          }
      });
    };
    const makeSource = (source: WorldSource) => {
      const info = SOURCE_INFO[source.kind];
      const group = new THREE.Group();
      group.userData.sourceId = source.id;
      const material = new THREE.MeshStandardMaterial({
        color: info.color,
        emissive: info.color,
        emissiveIntensity: 0.3,
        roughness: 0.45,
        metalness: 0.25,
      });
      const dark = new THREE.MeshStandardMaterial({
        color: 0x202d29,
        roughness: 0.5,
      });
      const body = new THREE.Group();
      body.position.y = 1.35;
      group.add(body);
      const mesh = (
        geometry: THREE.BufferGeometry,
        mat: THREE.Material = material,
        y = 0,
      ) => {
        const object = new THREE.Mesh(geometry, mat);
        object.position.y = y;
        object.castShadow = true;
        body.add(object);
        return object;
      };
      if (source.kind === "sound") {
        mesh(new THREE.BoxGeometry(0.38, 0.58, 0.28), dark);
        for (const y of [-0.1, 0.16]) {
          const cone = mesh(
            new THREE.CylinderGeometry(
              y < 0 ? 0.13 : 0.065,
              y < 0 ? 0.13 : 0.065,
              0.04,
              24,
            ),
            material,
            y,
          );
          cone.rotation.x = Math.PI / 2;
          cone.position.z = 0.16;
        }
      } else if (source.kind === "smell") {
        mesh(new THREE.SphereGeometry(0.23, 20, 16));
        const leaf = mesh(new THREE.SphereGeometry(0.1, 12, 8), dark, 0.25);
        leaf.scale.set(1.3, 0.35, 0.6);
        leaf.rotation.z = 0.6;
      } else if (source.kind === "wind") {
        mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 32), dark);
        for (let i = 0; i < 3; i++) {
          const blade = mesh(new THREE.BoxGeometry(0.11, 0.28, 0.035));
          const angle = (i * Math.PI * 2) / 3;
          blade.position.set(Math.sin(angle) * 0.13, Math.cos(angle) * 0.13, 0);
          blade.rotation.z = -angle;
        }
      } else if (source.kind === "touch") {
        mesh(new THREE.IcosahedronGeometry(0.28, 0));
      } else if (source.kind === "taste") {
        mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.1, 24));
        mesh(new THREE.SphereGeometry(0.12, 16, 12), material, 0.13);
      } else {
        mesh(
          source.kind === "loom"
            ? new THREE.OctahedronGeometry(0.23)
            : new THREE.SphereGeometry(0.15, 20, 16),
        );
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.35, 48),
        new THREE.MeshBasicMaterial({
          color: info.color,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.025;
      group.add(ring);
      group.userData.ring = ring;
      group.userData.body = body;
      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0.03, 0),
          new THREE.Vector3(0, 1.2, 0),
        ]),
        new THREE.LineBasicMaterial({
          color: info.color,
          transparent: true,
          opacity: 0.2,
        }),
      );
      group.add(stem);
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.008, 4, 48),
        new THREE.MeshBasicMaterial({
          color: info.color,
          transparent: true,
          opacity: 0.4,
        }),
      );
      wave.rotation.x = Math.PI / 2;
      body.add(wave);
      group.userData.wave = wave;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 80;
      const c = canvas.getContext("2d")!;
      c.font = "500 28px sans-serif";
      c.textAlign = "center";
      c.fillStyle = info.color;
      c.fillText(info.label.toUpperCase(), 256, 45);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(canvas),
          transparent: true,
          depthTest: false,
        }),
      );
      label.position.y = 1.98;
      label.scale.set(1.9, 0.3, 1);
      group.add(label);
      scene.add(group);
      return group;
    };
    const placementRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.34, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf2b56b,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    placementRing.rotation.x = -Math.PI / 2;
    placementRing.visible = false;
    scene.add(placementRing);
    const trailData = new Float32Array(240 * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailData, 3));
    trailGeo.setDrawRange(0, 0);
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({
        color: 0xc5eea1,
        transparent: true,
        opacity: 0.25,
      }),
    );
    trail.frustumCulled = false;
    scene.add(trail);
    let trailCount = 0,
      lastTrail = 0,
      lastReset = -1,
      lastOverhead = false;
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.35);
    const intersect = new THREE.Vector3();
    let dragging: string | null = null;
    const dragOffset = new THREE.Vector2();
    let pointerInside = false;
    const aim = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
    };
    const bounded = () => {
      const length = Math.hypot(intersect.x, intersect.z);
      const factor = length > 4.8 ? 4.8 / length : 1;
      return { x: intersect.x * factor, z: intersect.z * factor };
    };
    const hitSource = () => {
      for (const hit of ray.intersectObjects(
        [...sourceMeshes.values()],
        true,
      )) {
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          if (object.userData.sourceId)
            return object.userData.sourceId as string;
          object = object.parent;
        }
      }
      return null;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      aim(e);
      if (
        world.current.placing &&
        ray.ray.intersectPlane(floorPlane, intersect)
      ) {
        const point = bounded();
        onPlace(world.current.placing, point.x, point.z);
        return;
      }
      const id = hitSource();
      if (!id) return;
      onSelect(id);
      const source = world.current.sources.find((s) => s.id === id);
      if (!source || !ray.ray.intersectPlane(dragPlane, intersect)) return;
      dragOffset.set(source.x - intersect.x, source.z - intersect.z);
      dragging = id;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      aim(e);
      pointerInside = true;
      if (dragging && ray.ray.intersectPlane(dragPlane, intersect)) {
        intersect.x += dragOffset.x;
        intersect.z += dragOffset.y;
        const point = bounded();
        onMove(dragging, point.x, point.z);
      }
      renderer.domElement.style.cursor = world.current.placing
        ? "crosshair"
        : dragging
          ? "grabbing"
          : hitSource()
            ? "grab"
            : "default";
      if (ray.ray.intersectPlane(floorPlane, intersect)) {
        const point = bounded();
        placementRing.position.set(point.x, 0.03, point.z);
      }
    };
    const up = (e: PointerEvent) => {
      if (renderer.domElement.hasPointerCapture(e.pointerId))
        renderer.domElement.releasePointerCapture(e.pointerId);
      dragging = null;
      controls.enabled = true;
    };
    const leave = () => {
      pointerInside = false;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    renderer.domElement.addEventListener("pointerleave", leave);
    const observer = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      if (width && height) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    observer.observe(host);
    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const w = world.current,
        n = neural.current,
        time = w.simTime;
      if (w.reset !== lastReset) {
        trailCount = 0;
        lastTrail = 0;
        trailGeo.setDrawRange(0, 0);
        lastReset = w.reset;
      }
      if (lastOverhead !== w.overhead) {
        camera.position.set(
          ...((w.overhead ? [0, 16, 0.01] : [9.5, 8, 11.5]) as [
            number,
            number,
            number,
          ]),
        );
        lastOverhead = w.overhead;
      }
      const altitude = 1.65 + Math.min(1.3, n.escape * 0.06);
      fly.position.set(
        w.x,
        THREE.MathUtils.lerp(fly.position.y || altitude, altitude, 0.06),
        w.z,
      );
      fly.rotation.set(
        w.running ? Math.sin(time * 2) * 0.025 : 0,
        w.heading,
        w.running
          ? THREE.MathUtils.clamp((n.right - n.left) * 0.02, -0.2, 0.2)
          : 0,
      );
      const flap = w.running
        ? Math.sin(time * (30 + Math.min(30, n.wing))) * 0.28
        : 0.08;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
      halo.position.set(w.x, 0.04, w.z);
      halo.material.opacity = w.running ? 0.35 : 0.15;
      const ids = new Set(w.sources.map((s) => s.id));
      for (const [id, group] of sourceMeshes)
        if (!ids.has(id)) {
          scene.remove(group);
          disposeObject(group);
          sourceMeshes.delete(id);
        }
      for (const source of w.sources) {
        let group = sourceMeshes.get(source.id);
        if (!group) {
          group = makeSource(source);
          sourceMeshes.set(source.id, group);
        }
        group.position.set(source.x, 0, source.z);
        const ring = group.userData.ring as THREE.Mesh<
          THREE.RingGeometry,
          THREE.MeshBasicMaterial
        >;
        ring.scale.setScalar(source.id === w.selectedId ? 1.35 : 1);
        ring.material.opacity = source.enabled
          ? source.id === w.selectedId
            ? 1
            : 0.5
          : 0.15;
        const body = group.userData.body as THREE.Group;
        const isPulse =
          source.kind === "loom" &&
          source.pulseAt >= 0 &&
          time >= source.pulseAt &&
          time - source.pulseAt < 0.45;
        body.scale.setScalar(
          isPulse ? 1 + (0.45 - (time - source.pulseAt)) * 2 : 1,
        );
        body.position.y =
          1.35 + (source.enabled ? Math.sin(time * 2 + source.x) * 0.035 : 0);
        const wave = group.userData.wave as THREE.Mesh<
          THREE.TorusGeometry,
          THREE.MeshBasicMaterial
        >;
        wave.visible = source.enabled;
        wave.scale.setScalar(
          1 +
            ((time * 0.7) % 1) *
              (source.kind === "sound" || source.kind === "smell" ? 1.8 : 0.2),
        );
        wave.material.opacity =
          source.strength * (1 - ((time * 0.7) % 1)) * 0.5;
      }
      placementRing.visible = !!w.placing && pointerInside;
      if (w.placing) {
        placementRing.material.color.set(SOURCE_INFO[w.placing].color);
        renderer.domElement.style.cursor = "crosshair";
      }
      grid.visible = w.grid;
      trail.visible = w.trails;
      if (w.running && time - lastTrail > 0.1) {
        if (trailCount === 240) {
          trailData.copyWithin(0, 3);
          trailCount--;
        }
        trailData.set([w.x, fly.position.y, w.z], trailCount++ * 3);
        trailGeo.setDrawRange(0, trailCount);
        trailGeo.attributes.position.needsUpdate = true;
        lastTrail = time;
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      renderer.domElement.removeEventListener("pointerleave", leave);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [world, neural, onPlace, onSelect, onMove, onError]);
  return <div className="chamber-canvas" ref={mount} />;
}
