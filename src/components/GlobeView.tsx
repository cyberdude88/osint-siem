import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as topojson from "topojson-client";
import type { Alert } from "@/types/alert";
import { severityColors } from "@/lib/severity";

const WORLD_TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  alerts: Alert[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

export function GlobeView({ alerts, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const pointMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const frameRef = useRef<number>(0);
  const mouseRef = useRef({ isDown: false, prevX: 0, prevY: 0 });
  const rotationRef = useRef({ autoRotate: true });

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
    camera.position.z = 3.2;

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
      color: 0x070d18,
      emissive: 0x050a14,
      shininess: 5,
    });
    globeGroup.add(new THREE.Mesh(oceanGeo, oceanMat));

    // --- Atmosphere glow ---
    const glowGeo = new THREE.SphereGeometry(1.12, 64, 64);
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
          float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
          gl_FragColor = vec4(0.23, 0.51, 0.96, 1.0) * intensity;
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
          const coastMat = new THREE.LineBasicMaterial({
            color: 0x2488cc,
            transparent: true,
            opacity: 0.7,
          });
          drawGeoJson(land, 1.002, coastMat, globeGroup);
        }
      })
      .catch((err) => console.warn("Failed to load world map:", err));

    // --- Alert points ---
    const pointMeshes = new Map<string, THREE.Mesh>();
    const glowMeshes: THREE.Mesh[] = [];
    const allDotMeshes: { mesh: THREE.Mesh; baseSize: number; severity: string }[] = [];
    alerts.forEach((alert, idx) => {
      const pos = latLngToVector3(alert.lat, alert.lng, 1.02);
      const size =
        alert.severity === "critical"
          ? 0.032
          : alert.severity === "high"
          ? 0.026
          : 0.018;
      const color = new THREE.Color(severityColors[alert.severity]);

      // Core dot
      const dotGeo = new THREE.SphereGeometry(size, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      dotMesh.position.copy(pos);
      dotMesh.userData = { alertId: alert.alert_id };
      globeGroup.add(dotMesh);
      pointMeshes.set(alert.alert_id, dotMesh);
      allDotMeshes.push({ mesh: dotMesh, baseSize: 1, severity: alert.severity });

      // Outer glow halo (breathes)
      const glowG = new THREE.SphereGeometry(size * 4, 16, 16);
      const glowM = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
      });
      const gm = new THREE.Mesh(glowG, glowM);
      gm.position.copy(pos);
      gm.userData = { phase: idx * 0.8 };
      globeGroup.add(gm);
      glowMeshes.push(gm);
    });
    pointMeshesRef.current = pointMeshes;

    // --- Pulse rings for ALL alerts (bigger + faster for critical/high) ---
    const ringMeshes: { mesh: THREE.Mesh; speed: number; maxScale: number }[] = [];
    alerts.forEach((alert, idx) => {
      const pos = latLngToVector3(alert.lat, alert.lng, 1.025);
      const isCritHigh = alert.severity === "critical" || alert.severity === "high";
      const innerR = isCritHigh ? 0.02 : 0.012;
      const outerR = isCritHigh ? 0.055 : 0.035;
      const rGeo = new THREE.RingGeometry(innerR, outerR, 32);
      const rMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(severityColors[alert.severity]),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.copy(pos);
      rMesh.lookAt(new THREE.Vector3(0, 0, 0));
      rMesh.userData = { phase: idx * 1.3 };
      globeGroup.add(rMesh);
      ringMeshes.push({
        mesh: rMesh,
        speed: isCritHigh ? 3.0 : 1.8,
        maxScale: isCritHigh ? 2.5 : 1.8,
      });
    });

    // --- Initial tilt ---
    globeGroup.rotation.x = 0.35;

    // --- Animate ---
    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.016;
      if (rotationRef.current.autoRotate) {
        globeGroup.rotation.y += 0.0012;
      }

      // Breathing glow halos
      glowMeshes.forEach((gm) => {
        const phase = (gm.userData as { phase: number }).phase;
        const breath = 1 + Math.sin(t * 1.5 + phase) * 0.35;
        gm.scale.set(breath, breath, breath);
        (gm.material as THREE.MeshBasicMaterial).opacity =
          0.12 + Math.sin(t * 1.5 + phase) * 0.08;
      });

      // Dot breathing (subtle scale pulse)
      allDotMeshes.forEach((entry, i) => {
        const pulse =
          entry.severity === "critical"
            ? 1 + Math.sin(t * 3.0 + i * 0.9) * 0.3
            : entry.severity === "high"
            ? 1 + Math.sin(t * 2.2 + i * 1.1) * 0.2
            : 1 + Math.sin(t * 1.4 + i * 1.3) * 0.12;
        entry.mesh.scale.set(pulse, pulse, pulse);
      });

      // Expanding ring waves
      ringMeshes.forEach(({ mesh, speed, maxScale }) => {
        const phase = (mesh.userData as { phase: number }).phase;
        const cycle = ((t * speed + phase) % (Math.PI * 2)) / (Math.PI * 2);
        const s = 1 + cycle * (maxScale - 1);
        mesh.scale.set(s, s, 1);
        (mesh.material as THREE.MeshBasicMaterial).opacity =
          0.7 * Math.max(0, 1 - cycle);
      });

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
      setTimeout(() => {
        rotationRef.current.autoRotate = true;
      }, 3000);
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
      }
    };

    const el = renderer.domElement;
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("click", onClk);

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObs.disconnect();
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
      el.removeEventListener("click", onClk);
      container.removeChild(el);
      renderer.dispose();
    };
  }, [alerts, onSelect]);

  // --- Highlight selected point ---
  useEffect(() => {
    pointMeshesRef.current.forEach((mesh, id) => {
      const alert = alerts.find((a) => a.alert_id === id);
      if (!alert) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
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
        Drag to rotate &middot; Click alert points
      </div>
    </div>
  );
}
