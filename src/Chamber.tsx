import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NeuralState, SensoryInput, WorldState } from "./types";

interface Props {
  world: MutableRefObject<WorldState>;
  neural: MutableRefObject<NeuralState>;
  onInput: (input: SensoryInput) => void;
  onError: (error: string) => void;
}
export default function Chamber({ world, neural, onInput, onError }: Props) {
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
      "3D fly chamber. Drag to move the stimulus; right-drag to orbit. Arrow keys also move the stimulus.",
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
    const target = new THREE.Group();
    scene.add(target);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf6b46b,
      emissive: 0xf29b43,
      emissiveIntensity: 2,
    });
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 16),
      coreMat,
    );
    target.add(core);
    const targetLight = new THREE.PointLight(0xffb057, 5, 5);
    target.add(targetLight);
    for (const radius of [0.24, 0.37]) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.007, 4, 64),
        new THREE.MeshBasicMaterial({
          color: 0xefb26c,
          transparent: true,
          opacity: 0.55,
        }),
      );
      r.rotation.x = Math.PI / 2;
      target.add(r);
    }
    const shadow = new THREE.Mesh(
      new THREE.RingGeometry(0.17, 0.2, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf0b26c,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    scene.add(shadow);
    const projectionGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1.8, 0),
    ]);
    target.add(
      new THREE.Line(
        projectionGeo,
        new THREE.LineDashedMaterial({
          color: 0xffc28a,
          transparent: true,
          opacity: 0.2,
          dashSize: 0.08,
          gapSize: 0.08,
        }),
      ),
    );
    (
      target.children[target.children.length - 1] as THREE.Line
    ).computeLineDistances();
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
      lastInput = 0,
      lastReset = -1,
      lastOverhead = false;
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.8),
      intersect = new THREE.Vector3();
    let dragging = false;
    const placeTarget = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      if (ray.ray.intersectPlane(plane, intersect)) {
        const len = Math.hypot(intersect.x, intersect.z),
          factor = len > 4.8 ? 4.8 / len : 1;
        world.current.targetX = intersect.x * factor;
        world.current.targetZ = intersect.z * factor;
      }
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
      placeTarget(e);
    };
    const move = (e: PointerEvent) => {
      if (dragging) placeTarget(e);
    };
    const up = () => {
      dragging = false;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
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
    const clock = new THREE.Clock();
    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05),
        time = clock.elapsedTime,
        w = world.current,
        n = neural.current;
      if (w.reset !== lastReset) {
        trailCount = 0;
        w.x = -1;
        w.z = 0.6;
        w.heading = 1.6;
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
      if (w.running) {
        // Cruise is an explicit body-controller choice; steering and escape read neural outputs.
        w.heading +=
          THREE.MathUtils.clamp(
            (n.left - n.right) * 0.16 + (n.windLeft - n.windRight) * 0.09,
            -2,
            2,
          ) * delta;
        const speed = 0.24 + Math.min(0.35, n.wing * 0.015);
        w.x += Math.sin(w.heading) * speed * delta;
        w.z += Math.cos(w.heading) * speed * delta;
        const radius = Math.hypot(w.x, w.z);
        if (radius > 4.65) {
          w.x *= 4.65 / radius;
          w.z *= 4.65 / radius;
          w.heading += Math.PI * 0.8;
        }
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
      target.position.set(w.targetX, 1.8, w.targetZ);
      shadow.position.x = w.targetX;
      shadow.position.z = w.targetZ;
      const isPulse = performance.now() - w.pulse < 450;
      target.scale.setScalar(
        isPulse ? 1 + (450 - (performance.now() - w.pulse)) / 200 : 1,
      );
      coreMat.emissive.setHex(
        w.mode === "loom" ? 0xf17c5c : w.mode === "wind" ? 0xa5b5f2 : 0xf29b43,
      );
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
      if (time - lastInput > 0.05) {
        const bearing =
          Math.atan2(w.targetX - w.x, w.targetZ - w.z) - w.heading;
        const normalized = Math.atan2(Math.sin(bearing), Math.cos(bearing));
        const inView = Math.abs(normalized) < Math.PI * 0.85;
        const left = THREE.MathUtils.clamp(0.5 + normalized / 0.7, 0, 1);
        const amount = w.intensity * (inView ? 1 : 0);
        const input: SensoryInput = {
          left: w.mode === "target" ? amount * left : 0,
          right: w.mode === "target" ? amount * (1 - left) : 0,
          looming: w.mode === "loom" && isPulse ? w.intensity : 0,
          windLeft: w.mode === "wind" ? amount * left : 0,
          windRight: w.mode === "wind" ? amount * (1 - left) : 0,
          enabled: !w.isolated,
        };
        w.input = input;
        onInput(input);
        lastInput = time;
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
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          for (const m of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [world, neural, onInput, onError]);
  return <div className="chamber-canvas" ref={mount} />;
}
