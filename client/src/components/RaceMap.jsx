import { useRef, useEffect, useState, useCallback } from 'react';

// Interpolation window matches poll interval (boats arrive every 10s)
const INTERP_DURATION = 9200;
// Max trail positions kept per boat
const TRAIL_MAX = 10;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function RaceMap({ waypoints, boats, playerBoat, wind }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const dimRef = useRef({ width: 800, height: 600 });

  // Keep latest props accessible inside RAF without re-creating loop
  const waypointsRef = useRef(waypoints);
  const playerBoatRef = useRef(playerBoat);
  const windRef = useRef(wind);
  const rafRef = useRef(null);

  // Interpolation state
  const interpRef = useRef({
    fromBoats: {},   // boatId -> {lat, lon}
    toBoats: {},     // boatId -> full boat object
    startTime: Date.now(),
    drawn: {},       // boatId -> {lat, lon} — positions actually drawn last frame
  });

  // Trail history: boatId -> [{lat, lon}, ...]
  const trailRef = useRef({});

  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  useEffect(() => { playerBoatRef.current = playerBoat; }, [playerBoat]);
  useEffect(() => { windRef.current = wind; }, [wind]);

  // When server sends new boat positions, set up a new interpolation segment
  useEffect(() => {
    if (!boats) return;
    const interp = interpRef.current;

    // Snapshot where we currently are as the new "from"
    interp.fromBoats = { ...interp.drawn };

    // Build target map
    const to = {};
    boats.forEach(b => { to[b.id] = b; });
    interp.toBoats = to;
    interp.startTime = Date.now();

    // Append new positions to trails
    boats.forEach(b => {
      if (!trailRef.current[b.id]) trailRef.current[b.id] = [];
      const trail = trailRef.current[b.id];
      const last = trail[trail.length - 1];
      if (!last || last.lat !== b.lat || last.lon !== b.lon) {
        trail.push({ lat: b.lat, lon: b.lon });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
    });
  }, [boats]);

  // Resize observer
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      setDimensions({ width: w, height: h });
      dimRef.current = { width: w, height: h };
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ─── Coordinate helpers (pure functions, no closures on stale state) ───────

  function getBounds(wps) {
    if (!wps || wps.length === 0) {
      return { minLat: 47, maxLat: 49, minLon: -5, maxLon: -2 };
    }
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    wps.forEach(wp => {
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
      minLon = Math.min(minLon, wp.lon);
      maxLon = Math.max(maxLon, wp.lon);
    });
    const latPad = (maxLat - minLat) * 0.2 || 0.5;
    const lonPad = (maxLon - minLon) * 0.2 || 0.5;
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
    };
  }

  function toCanvas(lat, lon, bounds, w, h) {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * w;
    const y = h - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * h;
    return { x, y };
  }

  function toLatLon(x, y, bounds, w, h) {
    const lon = (x / w) * (bounds.maxLon - bounds.minLon) + bounds.minLon;
    const lat = ((h - y) / h) * (bounds.maxLat - bounds.minLat) + bounds.minLat;
    return { lat, lon };
  }

  function performanceColor(heading, windDir) {
    let a = Math.abs(heading - windDir);
    if (a > 180) a = 360 - a;
    if (a < 45) return 'rgba(239,68,68,0.10)';
    if (a < 60) return 'rgba(251,191,36,0.07)';
    if (a > 150) return 'rgba(251,191,36,0.07)';
    return 'rgba(34,197,94,0.07)';
  }

  // ─── RAF animation loop (started once, reads all data from refs) ──────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw(timestamp) {
      const ctx = canvas.getContext('2d');
      const { width, height } = dimRef.current;
      const wps = waypointsRef.current;
      const curWind = windRef.current;
      const curPlayer = playerBoatRef.current;
      const interp = interpRef.current;
      const bounds = getBounds(wps);
      const t = Math.min(1, (Date.now() - interp.startTime) / INTERP_DURATION);
      const et = easeInOut(t);

      // Compute interpolated positions for this frame
      const drawnNow = {};
      Object.keys(interp.toBoats).forEach(id => {
        const to = interp.toBoats[id];
        const from = interp.fromBoats[id];
        if (from) {
          drawnNow[id] = {
            lat: lerp(from.lat, to.lat, et),
            lon: lerp(from.lon, to.lon, et),
          };
        } else {
          drawnNow[id] = { lat: to.lat, lon: to.lon };
        }
      });
      interp.drawn = drawnNow;

      // ── 1. OCEAN BACKGROUND ───────────────────────────────────────────────
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
      oceanGrad.addColorStop(0, '#0a3352');
      oceanGrad.addColorStop(1, '#071e30');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, width, height);

      // ── 2. ANIMATED WAVE LINES ────────────────────────────────────────────
      const waveTime = timestamp * 0.00035;
      const waveSpacing = 22;
      for (let row = 0; row < Math.ceil(height / waveSpacing); row++) {
        const baseY = row * waveSpacing;
        const alpha = 0.04 + 0.025 * Math.sin(row * 0.4 + waveTime);
        ctx.strokeStyle = `rgba(100,200,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 3) {
          const wave1 = Math.sin((x * 0.018) + waveTime * 2.1 + row * 0.5) * 2.5;
          const wave2 = Math.sin((x * 0.009) + waveTime * 1.3 + row * 0.8) * 1.5;
          const y = baseY + wave1 + wave2;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // ── 3. PERFORMANCE ZONES (subtle tint only) ───────────────────────────
      if (curWind && curPlayer && wps && wps[curPlayer.currentWaypoint]) {
        const target = wps[curPlayer.currentWaypoint];
        const gridSize = 80;
        for (let gx = 0; gx < width; gx += gridSize) {
          for (let gy = 0; gy < height; gy += gridSize) {
            const cell = toLatLon(gx + gridSize / 2, gy + gridSize / 2, bounds, width, height);
            const dx = target.lon - cell.lon;
            const dy = target.lat - cell.lat;
            const hdg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            ctx.fillStyle = performanceColor(hdg, curWind.direction);
            ctx.fillRect(gx, gy, gridSize, gridSize);
          }
        }
      }

      // ── 4. SUBTLE GRID ────────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(14,165,233,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // ── 5. ANIMATED WIND PARTICLES ────────────────────────────────────────
      if (curWind) {
        const windRad = (curWind.direction * Math.PI) / 180;
        const spacing = 95;
        const particleSpeed = (curWind.speed / 35) * 0.025; // 0..0.025 phase/ms
        const phase = (timestamp * particleSpeed) % 1;

        ctx.save();
        for (let px = spacing / 2; px < width; px += spacing) {
          for (let py = spacing / 2; py < height; py += spacing) {
            // Stagger each cell with a unique offset
            const cellPhase = (phase + (px * 0.003 + py * 0.007)) % 1;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(windRad);

            // Draw 3 dots flowing along wind direction, one per cell
            for (let k = 0; k < 3; k++) {
              const dotPhase = (cellPhase + k / 3) % 1;
              const offset = (dotPhase - 0.5) * spacing * 0.7;
              const alpha = Math.sin(dotPhase * Math.PI) * 0.55;
              const size = 1.5 + Math.sin(dotPhase * Math.PI) * 1.2;
              ctx.beginPath();
              ctx.arc(0, offset, size, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(56,189,248,${alpha.toFixed(2)})`;
              ctx.fill();
            }
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // ── 6. RACE ROUTE LINE ────────────────────────────────────────────────
      if (wps && wps.length > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([9, 6]);
        ctx.beginPath();
        wps.forEach((wp, i) => {
          const pos = toCanvas(wp.lat, wp.lon, bounds, width, height);
          i === 0 ? ctx.moveTo(pos.x, pos.y) : ctx.lineTo(pos.x, pos.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── 7. BOAT TRAILS (wakes) ────────────────────────────────────────────
      Object.keys(trailRef.current).forEach(id => {
        const trail = trailRef.current[id];
        if (trail.length < 2) return;

        // Get color for this boat
        const boatData = interp.toBoats[id];
        const isPlayer = curPlayer && boatData && boatData.id === curPlayer.id;
        const baseColor = isPlayer ? '34,197,94' : boatData?.isBot ? '107,114,128' : '59,130,246';

        ctx.save();
        for (let i = 1; i < trail.length; i++) {
          const ratio = i / trail.length;
          const alpha = ratio * 0.35;
          const width2 = ratio * (isPlayer ? 4 : 2.5);
          const p0 = toCanvas(trail[i - 1].lat, trail[i - 1].lon, bounds, width, height);
          const p1 = toCanvas(trail[i].lat, trail[i].lon, bounds, width, height);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${baseColor},${alpha.toFixed(2)})`;
          ctx.lineWidth = width2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      });

      // ── 8. WAYPOINTS ─────────────────────────────────────────────────────
      if (wps) {
        wps.forEach((wp, i) => {
          const pos = toCanvas(wp.lat, wp.lon, bounds, width, height);
          const isStart = i === 0;
          const isEnd = i === wps.length - 1;
          const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#f59e0b';

          // Pulse ring for next target waypoint
          if (curPlayer && i === curPlayer.currentWaypoint) {
            const pulse = 0.4 + 0.3 * Math.sin(timestamp * 0.004);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 11, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(i + 1, pos.x, pos.y);

          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.font = '10px sans-serif';
          ctx.fillText(wp.name, pos.x, pos.y + 20);
        });
      }

      // ── 9. BOATS ─────────────────────────────────────────────────────────
      Object.keys(interp.toBoats).forEach(id => {
        const boatData = interp.toBoats[id];
        const ipos = drawnNow[id];
        if (!ipos) return;

        const pos = toCanvas(ipos.lat, ipos.lon, bounds, width, height);
        const isPlayer = curPlayer && boatData.id === curPlayer.id;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate((boatData.heading * Math.PI) / 180);

        // Player glow
        if (isPlayer) {
          const glowAlpha = boatData.boostActive
            ? 0.35 + 0.2 * Math.sin(timestamp * 0.01)
            : 0.18;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fillStyle = boatData.boostActive
            ? `rgba(251,191,36,${glowAlpha.toFixed(2)})`
            : `rgba(34,197,94,${glowAlpha.toFixed(2)})`;
          ctx.fill();
        }

        // Sailboat silhouette (top-down view)
        const size = isPlayer ? 15 : 10;
        const hullColor = isPlayer
          ? (boatData.boostActive ? '#fbbf24' : '#22c55e')
          : boatData.isBot ? '#6b7280' : '#3b82f6';
        const strokeColor = (isPlayer || !boatData.isBot) ? 'white' : '#9ca3af';

        // Hull – teardrop: bow at top (0,-size), stern at bottom
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.bezierCurveTo( size * 0.5, -size * 0.1,  size * 0.38, size * 0.65, 0, size * 0.75);
        ctx.bezierCurveTo(-size * 0.38, size * 0.65, -size * 0.5, -size * 0.1, 0, -size);
        ctx.closePath();
        ctx.fillStyle = hullColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isPlayer ? 1.5 : 1;
        ctx.fill();
        ctx.stroke();

        // Mast – vertical line
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.55);
        ctx.lineTo(0, size * 0.25);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isPlayer ? 1.5 : 1;
        ctx.stroke();

        // Mainsail – triangle (mast top → boom end → boom root)
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.55);           // mast head
        ctx.lineTo(size * 0.85, size * 0.25);  // clew (boom end)
        ctx.lineTo(0, size * 0.1);             // tack (boom root)
        ctx.closePath();
        ctx.fillStyle = isPlayer
          ? (boatData.boostActive ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.45)')
          : boatData.isBot
            ? 'rgba(255,255,255,0.18)'
            : 'rgba(255,255,255,0.35)';
        ctx.fill();

        ctx.restore();

        // Name label for player only
        if (isPlayer) {
          ctx.fillStyle = boatData.boostActive ? '#fbbf24' : '#22c55e';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(boatData.name, pos.x, pos.y + 18);
        }
      });

      // ── 10. WIND COMPASS (corner) ─────────────────────────────────────────
      if (curWind) {
        const wx = width - 72;
        const wy = 80;

        ctx.save();
        ctx.translate(wx, wy);

        // Background
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,51,82,0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(14,165,233,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cardinal ticks
        for (let i = 0; i < 8; i++) {
          const tickRad = (i * 45 * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(Math.sin(tickRad) * 38, -Math.cos(tickRad) * 38);
          ctx.lineTo(Math.sin(tickRad) * 43, -Math.cos(tickRad) * 43);
          ctx.strokeStyle = 'rgba(14,165,233,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Wind arrow (rotates with wind direction)
        ctx.rotate((curWind.direction * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(0, -33);
        ctx.lineTo(-9, 14);
        ctx.lineTo(0, 6);
        ctx.lineTo(9, 14);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.restore();

        // Wind info
        ctx.fillStyle = 'white';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(curWind.speed)} kn`, wx, wy + 56);
        ctx.fillStyle = 'rgba(148,163,184,0.8)';
        ctx.font = '9px sans-serif';
        ctx.fillText(curWind.directionText || '', wx, wy + 68);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // Runs once — all data via refs

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-ocean-900/90 backdrop-blur-sm rounded-lg p-3 text-xs">
        <div className="text-ocean-300 mb-2 font-medium">Légende</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-green-500/40 rounded" />
          <span className="text-white">Zone rapide</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-yellow-500/40 rounded" />
          <span className="text-white">Zone moyenne</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500/40 rounded" />
          <span className="text-white">Zone interdite</span>
        </div>
      </div>
    </div>
  );
}

export default RaceMap;
