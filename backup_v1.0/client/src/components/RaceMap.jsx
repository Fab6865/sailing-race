import { useRef, useEffect, useState } from 'react';

function RaceMap({ waypoints, boats, playerBoat, wind }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Calculate map bounds from waypoints
  const getBounds = () => {
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
  };

  // Convert lat/lon to canvas coordinates
  const toCanvas = (lat, lon, bounds, width, height) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * width;
    const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
    return { x, y };
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

    // Clear canvas
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, width, height);

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

    // Draw route line
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

    // Draw wind arrow in corner
    const windX = width - 60;
    const windY = 60;
    
    ctx.save();
    ctx.translate(windX, windY);
    
    // Wind circle background
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 74, 110, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wind direction arrow
    ctx.rotate((wind.direction * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-8, 10);
    ctx.lineTo(0, 0);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    
    ctx.restore();

  }, [waypoints, boats, playerBoat, wind, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
    </div>
  );
}

export default RaceMap;
