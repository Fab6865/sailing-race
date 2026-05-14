import { useRef, useEffect, useState, useCallback } from 'react';

function RaceMap({ waypoints, boats, playerBoat, wind }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Calculate map bounds from waypoints
  const getBounds = useCallback(() => {
    if (!waypoints || waypoints.length === 0) {
      return { minLat: 47, maxLat: 49, minLon: -5, maxLon: -2 };
    }

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    waypoints.forEach(wp => {
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
      minLon = Math.min(minLon, wp.lon);
      maxLon = Math.max(maxLon, wp.lon);
    });

    // Add padding
    const latPadding = (maxLat - minLat) * 0.2 || 0.5;
    const lonPadding = (maxLon - minLon) * 0.2 || 0.5;

    return {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding
    };
  }, [waypoints]);

  // Convert lat/lon to canvas coordinates
  const toCanvas = (lat, lon, bounds, width, height) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
    const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
    return { x, y };
  };

  // Convert canvas coordinates to lat/lon
  const toLatLon = (x, y, bounds, width, height) => {
    const lon = (x / width) * (bounds.maxLon - bounds.minLon) + bounds.minLon;
    const lat = ((height - y) / height) * (bounds.maxLat - bounds.minLat) + bounds.minLat;
    return { lat, lon };
  };

  // Calculate performance zone color based on wind angle
  const getPerformanceColor = (heading, windDirection) => {
    let angleToWind = Math.abs(heading - windDirection);
    if (angleToWind > 180) angleToWind = 360 - angleToWind;

    if (angleToWind < 45) {
      return 'rgba(239, 68, 68, 0.3)'; // Red - no-go zone
    } else if (angleToWind < 60) {
      return 'rgba(251, 191, 36, 0.2)'; // Yellow - slow
    } else if (angleToWind > 150) {
      return 'rgba(251, 191, 36, 0.2)'; // Yellow - running
    } else {
      return 'rgba(34, 197, 94, 0.2)'; // Green - fast
    }
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    const bounds = getBounds();

    const currentWind = wind;

    // Clear canvas
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, width, height);

    // Draw performance zones (colored overlay based on wind)
    if (currentWind) {
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          // Calculate heading from center of cell to next waypoint or general direction
          const cellCenter = toLatLon(x + gridSize/2, y + gridSize/2, bounds, width, height);
          
          // For each cell, calculate optimal heading and show performance
          // Simplified: show zones based on wind direction
          const directions = [0, 45, 90, 135, 180, 225, 270, 315];
          let bestColor = 'rgba(34, 197, 94, 0.15)';
          
          // Calculate angle from this point toward next waypoint
          if (playerBoat && waypoints && waypoints[playerBoat.currentWaypoint]) {
            const target = waypoints[playerBoat.currentWaypoint];
            const dx = target.lon - cellCenter.lon;
            const dy = target.lat - cellCenter.lat;
            const headingToTarget = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            bestColor = getPerformanceColor(headingToTarget, currentWind.direction);
          }
          
          ctx.fillStyle = bestColor;
          ctx.fillRect(x, y, gridSize, gridSize);
        }
      }
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Draw wind arrows grid
    if (currentWind) {
      const arrowSpacing = 100;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      
      for (let x = arrowSpacing/2; x < width; x += arrowSpacing) {
        for (let y = arrowSpacing/2; y < height; y += arrowSpacing) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((currentWind.direction * Math.PI) / 180);
          
          // Arrow size based on wind speed
          const size = Math.min(20, 8 + currentWind.speed / 3);
          
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(-size/3, size/2);
          ctx.lineTo(0, size/4);
          ctx.lineTo(size/3, size/2);
          ctx.closePath();
          ctx.fill();
          
          ctx.restore();
        }
      }
    }

    // Draw official race route line
    if (waypoints && waypoints.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();

      waypoints.forEach((wp, i) => {
        const pos = toCanvas(wp.lat, wp.lon, bounds, width, height);
        if (i === 0) {
          ctx.moveTo(pos.x, pos.y);
        } else {
          ctx.lineTo(pos.x, pos.y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw waypoints
    if (waypoints) {
      waypoints.forEach((wp, i) => {
        const pos = toCanvas(wp.lat, wp.lon, bounds, width, height);
        
        // Waypoint circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#22c55e' : i === waypoints.length - 1 ? '#ef4444' : '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Waypoint number
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, pos.x, pos.y);

        // Waypoint name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '11px sans-serif';
        ctx.fillText(wp.name, pos.x, pos.y + 22);
      });
    }

    // Draw boats
    if (boats) {
      boats.forEach(boat => {
        const pos = toCanvas(boat.lat, boat.lon, bounds, width, height);
        const isPlayer = playerBoat && boat.id === playerBoat.id;

        // Boat triangle
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate((boat.heading * Math.PI) / 180);

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-6, 8);
        ctx.lineTo(6, 8);
        ctx.closePath();

        if (isPlayer) {
          ctx.fillStyle = '#22c55e';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
        } else if (boat.isBot) {
          ctx.fillStyle = '#6b7280';
          ctx.strokeStyle = '#9ca3af';
          ctx.lineWidth = 1;
        } else {
          ctx.fillStyle = '#3b82f6';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Boat name (only for player and nearby boats)
        if (isPlayer) {
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(boat.name, pos.x, pos.y + 18);
        }
      });
    }

    // Draw main wind indicator in corner
    if (currentWind) {
      const windX = width - 70;
      const windY = 80;
      
      ctx.save();
      ctx.translate(windX, windY);
      
      // Wind circle background
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 74, 110, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wind direction arrow
      ctx.rotate((currentWind.direction * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, -35);
      ctx.lineTo(-10, 15);
      ctx.lineTo(0, 5);
      ctx.lineTo(10, 15);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      
      ctx.restore();

      // Wind info text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(currentWind.speed)} kn`, windX, windY + 55);
    }

  }, [waypoints, boats, playerBoat, wind, dimensions, getBounds]);

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
          <div className="w-4 h-4 bg-green-500/40 rounded"></div>
          <span className="text-white">Zone rapide</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-yellow-500/40 rounded"></div>
          <span className="text-white">Zone moyenne</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500/40 rounded"></div>
          <span className="text-white">Zone interdite</span>
        </div>
      </div>
    </div>
  );
}

export default RaceMap;
