import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as topojson from "topojson-client";
import type { Alert } from "@/types/alert";
import { severityColors } from "@/lib/severity";

const WORLD_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const US_STATES_GEOJSON_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
const AUTO_ROTATE_SPEED = 0.0003;
const AUTO_ROTATE_EASE = 2.8;
const ZOOM_MIN = 1.55;
const ZOOM_MAX = 4.6;
const ZOOM_STEP = 0.08;
const ZOOM_EASE = 7.5;
const INITIAL_TILT_X = 0.06;

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  regionFilter: string;
  onRegionChange: (region: string) => void;
  visibleAlertIds: string[];
}

function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function vector3ToLatLng(vec: THREE.Vector3): { lat: number; lng: number } {
  const v = vec.clone().normalize();
  const phi = Math.acos(v.y);
  const theta = Math.atan2(v.z, v.x);
  const lat = 90 - (phi * 180) / Math.PI;
  const lng = ((theta * 180) / Math.PI + 540) % 360 - 180;
  return { lat, lng };
}

function latLngToRegion(lat: number, lng: number): string | null {
  // Coarse continent buckets (good enough for region filtering)
  if (lat >= 7 && lat <= 83 && lng >= -168 && lng <= -52) return "North America";
  if (lat >= -56 && lat <= 13 && lng >= -82 && lng <= -35) return "South America";
  if (lat >= 35 && lat <= 72 && lng >= -11 && lng <= 40) return "Europe";
  if (lat >= -35 && lat <= 37 && lng >= -17 && lng <= 51) return "Africa";
  if (lat >= 5 && lat <= 77 && lng >= 40 && lng <= 180) return "Asia";
  if (lat >= -50 && lat <= 10 && lng >= 110 && lng <= 180) return "Oceania";
  if (lat < -60) return "Antarctica";
  return null;
}

function createGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const center = size / 2;
  const maxR = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const r = Math.sqrt(dx * dx + dy * dy) / maxR;
      const idx = (y * size + x) * 4;

      // Gaussian-like continuous fade (no hard stop bands).
      const alpha =
        r >= 1
          ? 0
          : Math.exp(-3.8 * r * r) * Math.pow(1 - r, 0.75);
      const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Convert a GeoJSON MultiLineString / Polygon ring coords into THREE.Line segments */
function coordsToLine(
  coords: number[][],
  radius: number,
  material: THREE.LineBasicMaterial,
  group: THREE.Group
) {
  const points: THREE.Vector3[] = [];
  for (const [lng, lat] of coords) {
    points.push(latLngToVector3(lat, lng, radius));
  }
  if (points.length < 2) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  group.add(line);
}

function drawGeoJson(
  geojson: GeoJSON.FeatureCollection,
  radius: number,
  material: THREE.LineBasicMaterial,
  group: THREE.Group
) {
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) {
        coordsToLine(ring, radius, material, group);
      }
    } else if (geom.type === "MultiPolygon") {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          coordsToLine(ring, radius, material, group);
        }
      }
    }
  }
}

function createSurfaceTexture(landGeo: GeoJSON.FeatureCollection): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.needsUpdate = true;
    return fallback;
  }

  // Water is slightly lighter black-blue; land remains darker.
  ctx.fillStyle = "#122033";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#070d18";

  const project = (lng: number, lat: number) => ({
    x: ((lng + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  });

  for (const feature of landGeo.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
    if (polygons.length === 0) continue;

    ctx.beginPath();
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (ring.length === 0) continue;
        const start = project(ring[0][0], ring[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < ring.length; i += 1) {
          const p = project(ring[i][0], ring[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
      }
    }
    ctx.fill("evenodd");
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function GlobeView({
  alerts,
  selectedId,
  onSelect,
  regionFilter,
  onRegionChange,
  visibleAlertIds,
}: Props) {
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    alerts.forEach((a) => {
      const r = a.source.region;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [alerts]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const oceanRef = useRef<THREE.Mesh | null>(null);
  const pointMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ isDown: false, prevX: 0, prevY: 0 });
  const zoomRef = useRef({ current: 3.2, target: 3.2 });
  const rotationRef = useRef({
    autoRotate: true,
    x: INITIAL_TILT_X,
    y: 0,
    currentSpeed: AUTO_ROTATE_SPEED,
  });
  const regionFilterRef = useRef(regionFilter);
  const selectedIdRef = useRef<string | null>(selectedId);
  const visibleAlertIdsRef = useRef<Set<string>>(new Set(visibleAlertIds));
  const regionSetRef = useRef<Set<string>>(new Set());
  const adjustZoom = (delta: number) => {
    const next = zoomRef.current.target + delta;
    zoomRef.current.target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
  };

  useEffect(() => {
    regionFilterRef.current = regionFilter;
  }, [regionFilter]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    visibleAlertIdsRef.current = new Set(visibleAlertIds);
  }, [visibleAlertIds]);

  useEffect(() => {
    regionSetRef.current = new Set(regions.map(([r]) => r));
  }, [regions]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene ---
    const scene = new THREE.Scene();

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = zoomRef.current.current;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0e17, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Globe group (everything rotates together) ---
    const globeGroup = new THREE.Group();
    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // --- Ocean sphere ---
    const oceanGeo = new THREE.SphereGeometry(0.995, 64, 64);
    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x050a14,
      shininess: 5,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    globeGroup.add(oceanMesh);
    oceanRef.current = oceanMesh;

    // --- Atmosphere glow ---
    const glowGeo = new THREE.SphereGeometry(1.04, 64, 64);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(max(0.0, 0.45 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
          gl_FragColor = vec4(0.12, 0.32, 0.62, intensity * 0.14);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    globeGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // --- Graticule (lat/lng grid) ---
    const gratMat = new THREE.LineBasicMaterial({
      color: 0x112244,
      transparent: true,
      opacity: 0.12,
    });
    // Latitude lines every 30 degrees
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lng = -180; lng <= 180; lng += 2) {
        pts.push(latLngToVector3(lat, lng, 1.0));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      globeGroup.add(new THREE.Line(g, gratMat));
    }
    // Equator line (slightly more visible reference)
    const equatorPts: THREE.Vector3[] = [];
    for (let lng = -180; lng <= 180; lng += 2) {
      equatorPts.push(latLngToVector3(0, lng, 1.001));
    }
    const equatorGeo = new THREE.BufferGeometry().setFromPoints(equatorPts);
    const equatorMat = new THREE.LineBasicMaterial({
      color: 0x2f5f86,
      transparent: true,
      opacity: 0.28,
    });
    globeGroup.add(new THREE.Line(equatorGeo, equatorMat));
    // Longitude lines every 30 degrees
    for (let lng = -180; lng < 180; lng += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 2) {
        pts.push(latLngToVector3(lat, lng, 1.0));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      globeGroup.add(new THREE.Line(g, gratMat));
    }

    // --- Lights ---
    scene.add(new THREE.AmbientLight(0x445566, 2));
    const pLight = new THREE.PointLight(0x3b82f6, 3, 12);
    pLight.position.set(3, 2, 4);
    scene.add(pLight);
    const pLight2 = new THREE.PointLight(0x1e40af, 1.5, 12);
    pLight2.position.set(-3, -1, 3);
    scene.add(pLight2);

    // --- Load world map (country boundaries) ---
    let surfaceTexture: THREE.CanvasTexture | null = null;
    fetch(WORLD_TOPO_URL)
      .then((r) => r.json())
      .then((topoData: any) => {
        const countries = topojson.feature(
          topoData,
          topoData.objects.countries
        ) as unknown as GeoJSON.FeatureCollection;

        // Country border lines
        const borderMat = new THREE.LineBasicMaterial({
          color: 0x1a6aaa,
          transparent: true,
          opacity: 0.55,
        });
        drawGeoJson(countries, 1.001, borderMat, globeGroup);

        // Coastline mesh (from the same topology)
        if (topoData.objects.land) {
          const land = topojson.feature(
            topoData,
            topoData.objects.land
          ) as unknown as GeoJSON.FeatureCollection;
          surfaceTexture = createSurfaceTexture(land);
          oceanMat.map = surfaceTexture;
          oceanMat.needsUpdate = true;
          const coastMat = new THREE.LineBasicMaterial({
            color: 0x2488cc,
            transparent: true,
            opacity: 0.7,
          });
          drawGeoJson(land, 1.002, coastMat, globeGroup);
        }
      })
      .catch((err) => console.warn("Failed to load world map:", err));

    // --- U.S. state boundaries (visible mainly when zoomed in) ---
    const usStateGroup = new THREE.Group();
    globeGroup.add(usStateGroup);
    const usStateMat = new THREE.LineBasicMaterial({
      color: 0x8eb7cf,
      transparent: true,
      opacity: 0,
    });
    fetch(US_STATES_GEOJSON_URL)
      .then((r) => r.json())
      .then((geo: GeoJSON.FeatureCollection) => {
        drawGeoJson(geo, 1.0032, usStateMat, usStateGroup);
      })
      .catch((err) => console.warn("Failed to load US states:", err));

    // --- Alert points ---
    const pointMeshes = new Map<string, THREE.Mesh>();
    const glowTexture = createGlowTexture();
    const glowMeshes: THREE.Mesh[] = [];
    const allDotMeshes: {
      mesh: THREE.Mesh;
      severity: string;
      alertId: string;
      baseGlow: number;
    }[] = [];
    alerts.forEach((alert, idx) => {
      const pos = latLngToVector3(alert.lat, alert.lng, 1.02);
      const size =
        alert.severity === "critical"
          ? 0.018
          : alert.severity === "high"
          ? 0.014
          : 0.011;
      const color = new THREE.Color(severityColors[alert.severity]);
      const glowColor = color.clone().lerp(new THREE.Color(0xfff3cc), 0.78);

      // Core dot
      const dotGeo = new THREE.SphereGeometry(size, 16, 16);
      const dotMat = new THREE.MeshPhongMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.5),
        shininess: 85,
        specular: new THREE.Color(0xffffff),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      dotMesh.userData = { alertId: alert.alert_id, region: alert.source.region };
      globeGroup.add(dotMesh);
      pointMeshes.set(alert.alert_id, dotMesh);

      // Bright inner center for a crisp, modern marker look
      const coreGeo = new THREE.SphereGeometry(size * 0.42, 10, 10);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      dotMesh.add(coreMesh);

      // Surface-hugging glow (tangent to globe) to avoid "dome" billboard look
      const glowM = new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: glowColor,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowM);
      gm.position.copy(pos);
      const baseGlow = size * 6;
      gm.scale.set(baseGlow, baseGlow, 1);
      const normal = pos.clone().normalize();
      gm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      gm.userData = {
        phase: idx * 0.8,
        region: alert.source.region,
        baseGlow,
        alertId: alert.alert_id,
      };
      globeGroup.add(gm);
      glowMeshes.push(gm);
      allDotMeshes.push({
        mesh: dotMesh,
        severity: alert.severity,
        alertId: alert.alert_id,
        baseGlow,
      });
    });
    pointMeshesRef.current = pointMeshes;

    // --- Initial tilt (persisted) ---
    globeGroup.rotation.x = rotationRef.current.x;
    globeGroup.rotation.y = rotationRef.current.y;

    // --- Animate ---
    let t = 0;
    let last = performance.now();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;
      t += delta;
      const targetSpeed = rotationRef.current.autoRotate ? AUTO_ROTATE_SPEED : 0;
      const ease = Math.min(1, delta * AUTO_ROTATE_EASE);
      rotationRef.current.currentSpeed +=
        (targetSpeed - rotationRef.current.currentSpeed) * ease;
      globeGroup.rotation.y += rotationRef.current.currentSpeed * delta;
      const zoomEase = Math.min(1, delta * ZOOM_EASE);
      zoomRef.current.current +=
        (zoomRef.current.target - zoomRef.current.current) * zoomEase;
      camera.position.z = zoomRef.current.current;
      rotationRef.current.x = globeGroup.rotation.x;
      rotationRef.current.y = globeGroup.rotation.y;

      const activeRegion = regionFilterRef.current;
      const selected = selectedIdRef.current;
      const visibleSet = visibleAlertIdsRef.current;
      const zoomLevel = zoomRef.current.current;
      const zoomNorm = Math.max(
        0,
        Math.min(1, (zoomLevel - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN))
      );
      const dotScaleBase = 0.42 + zoomNorm * 0.68; // smaller when zoomed in
      const glowScaleBase = 0.38 + zoomNorm * 0.62; // tighter glow when zoomed in

      // Keep surface glows static so they read as city lights, not VFX
      glowMeshes.forEach((gm) => {
        const alertId = (gm.userData as { alertId?: string }).alertId;
        const isVisibleInStack = !alertId || visibleSet.has(alertId);
        gm.visible = isVisibleInStack;
        if (!isVisibleInStack) return;
        const { baseGlow } = gm.userData as {
          baseGlow: number;
        };
        gm.scale.set(baseGlow * glowScaleBase, baseGlow * glowScaleBase, 1);
        const base = 0.13;
        const region = (gm.userData as { region?: string }).region;
        const dim = activeRegion === "all" || !region || region === activeRegion ? 1 : 0.15;
        (gm.material as THREE.MeshBasicMaterial).opacity = base * dim;
      });

      // Keep dots stable (no visible pulsing)
      allDotMeshes.forEach((entry) => {
        const isVisibleInStack = visibleSet.has(entry.alertId);
        entry.mesh.visible = isVisibleInStack;
        if (!isVisibleInStack) return;
        const region = (entry.mesh.userData as { region?: string }).region;
        const dim = activeRegion === "all" || !region || region === activeRegion ? 1 : 0.15;
        const selectedBoost = entry.alertId === selected ? 1.9 : 1;
        const dotScale = dotScaleBase * selectedBoost;
        entry.mesh.scale.set(dotScale, dotScale, dotScale);
        (entry.mesh.material as THREE.MeshBasicMaterial).opacity = dim;
      });

      // Fade in US state lines as user zooms closer to North America details.
      const stateFade = Math.max(0, Math.min(1, (2.45 - zoomLevel) / 0.9));
      usStateGroup.visible = stateFade > 0.01;
      usStateMat.opacity = 0.82 * stateFade;

      renderer.render(scene, camera);
    };
    animate();

    // --- Resize ---
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    // --- Mouse drag to rotate ---
    const onDown = (e: MouseEvent) => {
      mouseRef.current = { isDown: true, prevX: e.clientX, prevY: e.clientY };
      rotationRef.current.autoRotate = false;
    };
    const onMove = (e: MouseEvent) => {
      if (!mouseRef.current.isDown) return;
      globeGroup.rotation.y += (e.clientX - mouseRef.current.prevX) * 0.005;
      globeGroup.rotation.x += (e.clientY - mouseRef.current.prevY) * 0.005;
      globeGroup.rotation.x = Math.max(
        -1.2,
        Math.min(1.2, globeGroup.rotation.x)
      );
      mouseRef.current.prevX = e.clientX;
      mouseRef.current.prevY = e.clientY;
    };
    const onUp = () => {
      mouseRef.current.isDown = false;
      rotationRef.current.autoRotate = true;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const deltaScale =
        e.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const normalized = e.deltaY * deltaScale;
      if (normalized === 0) return;
      const dir = normalized > 0 ? 1 : -1;
      const intensity = Math.max(0.25, Math.min(1.2, Math.abs(normalized) / 140));
      adjustZoom(dir * ZOOM_STEP * intensity);
    };

    // --- Click raycasting ---
    const raycaster = new THREE.Raycaster();
    const mv = new THREE.Vector2();
    const onClk = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mv.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mv.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mv, camera);
      const hits = raycaster.intersectObjects(Array.from(pointMeshes.values()));
      if (hits.length > 0) {
        const id = hits[0].object.userData.alertId;
        if (id) onSelect(id);
        return;
      }
      const ocean = oceanRef.current;
      if (!ocean) return;
      const globeHits = raycaster.intersectObject(ocean);
      if (globeHits.length === 0) return;
      const hitPoint = globeHits[0].point;
      const { lat, lng } = vector3ToLatLng(hitPoint);
      const region = latLngToRegion(lat, lng);
      if (!region) return;
      if (!regionSetRef.current.has(region)) return;
      onRegionChange(region);
    };

    const el = renderer.domElement;
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("click", onClk);
    el.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObs.disconnect();
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
      el.removeEventListener("click", onClk);
      el.removeEventListener("wheel", onWheel);
      container.removeEventListener("wheel", onWheel);
      container.removeChild(el);
      renderer.dispose();
      glowTexture.dispose();
      surfaceTexture?.dispose();
      usStateMat.dispose();
    };
  }, [alerts, onSelect]);

  // --- Highlight selected point ---
  useEffect(() => {
    pointMeshesRef.current.forEach((mesh, id) => {
      const alert = alerts.find((a) => a.alert_id === id);
      if (!alert) return;
      const mat = mesh.material as THREE.MeshPhongMaterial;
      if (id === selectedId) {
        mat.color.set(0xffffff);
        mesh.scale.set(2.5, 2.5, 2.5);
      } else {
        mat.color.set(severityColors[alert.severity]);
        mesh.scale.set(1, 1, 1);
      }
    });
  }, [selectedId, alerts]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing"
    >
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 bg-siem-panel/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-siem-border">
        {(
          [
            ["critical", "bg-red-500"],
            ["high", "bg-orange-500"],
            ["medium", "bg-yellow-500"],
            ["low", "bg-green-500"],
            ["info", "bg-cyan-500"],
          ] as const
        ).map(([sev, bg]) => (
          <div
            key={sev}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-siem-muted"
          >
            <div className={`w-2 h-2 rounded-full ${bg}`} />
            {sev}
          </div>
        ))}
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-siem-muted/50 uppercase tracking-widest pointer-events-none">
        Drag to rotate &middot; Scroll to zoom &middot; Click alert points
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-siem-panel/80 backdrop-blur-sm px-2 py-2 rounded-lg border border-siem-border">
        <button
          onClick={() => adjustZoom(-ZOOM_STEP * 1.2)}
          className="w-7 h-7 rounded border border-siem-border bg-white/5 text-siem-text hover:bg-siem-accent/10 hover:text-siem-accent transition-colors text-sm font-bold"
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => adjustZoom(ZOOM_STEP * 1.2)}
          className="w-7 h-7 rounded border border-siem-border bg-white/5 text-siem-text hover:bg-siem-accent/10 hover:text-siem-accent transition-colors text-sm font-bold"
          aria-label="Zoom out"
          title="Zoom out"
        >
          -
        </button>
      </div>
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-siem-panel/80 backdrop-blur-sm px-2.5 py-2 rounded-lg border border-siem-border">
        <button
          onClick={() => onRegionChange("all")}
          className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded border transition-colors ${
            regionFilter === "all"
              ? "bg-siem-accent/20 text-siem-accent border-siem-accent/40"
              : "bg-white/5 text-siem-muted border-siem-border hover:bg-siem-accent/10 hover:text-siem-accent"
          }`}
        >
          All
        </button>
        {regions.map(([region]) => (
          <button
            key={region}
            onClick={() => onRegionChange(region)}
            className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded border transition-colors ${
              regionFilter === region
                ? "bg-siem-accent/20 text-siem-accent border-siem-accent/40"
                : "bg-white/5 text-siem-muted border-siem-border hover:bg-siem-accent/10 hover:text-siem-accent"
            }`}
          >
            {region}
          </button>
        ))}
      </div>
    </div>
  );
}
