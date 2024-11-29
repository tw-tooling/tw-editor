import React, { useEffect, useRef, useState } from 'react';
import { useLayers } from '../contexts/LayerContext';
import { TileManager } from '../renderer/TileManager';
import styles from './TileSelector.module.css';

interface TileSelectorProps {
  onTileSelect: (tileId: number) => void;
  selectedTileId: number;
}

export const TileSelector: React.FC<TileSelectorProps> = ({ onTileSelect, selectedTileId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileManagerRef = useRef<TileManager>(new TileManager());
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const tileSize = 64;
  const tilesPerRow = 16;
  const [tilesetImage, setTilesetImage] = useState<HTMLImageElement | null>(null);
  const { layers, selectedLayer } = useLayers();

  useEffect(() => {
    const activeLayer = layers[selectedLayer]?.parsed;
    if (!activeLayer || !('image' in activeLayer)) return;

    // Reset offset when changing tileset
    setOffset({ x: 0, y: 0 });

    // Load tileset using TileManager
    const loadTileset = async () => {
      const image = await tileManagerRef.current.getTileset(activeLayer.image);
      setTilesetImage(image);
    };

    loadTileset();
  }, [layers, selectedLayer]);

  // Initialize canvas size on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set initial canvas size
    canvas.width = 1024;
    canvas.height = 1024;

    // Draw loading state or placeholder
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'center';
      ctx.fillText('Loading tileset...', canvas.width / 2, canvas.height / 2);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tilesetImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match tilemap size
    canvas.width = 1024;
    canvas.height = 1024;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tileset
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.drawImage(tilesetImage, 0, 0);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Highlight selected tile if valid
    if (selectedTileId >= 0 && selectedTileId < tilesPerRow * tilesPerRow) {
      const selectedX = (selectedTileId % tilesPerRow) * tileSize;
      const selectedY = Math.floor(selectedTileId / tilesPerRow) * tileSize;
      ctx.strokeStyle = 'rgba(0, 162, 255, 0.8)';
      ctx.lineWidth = 5;
      ctx.strokeRect(selectedX, selectedY, tileSize, tileSize);
    }

    ctx.restore();
  }, [tilesetImage, offset, selectedTileId]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width; // Calculate scale based on actual canvas size
    const x = (e.clientX - rect.left - offset.x) * scale;
    const y = (e.clientY - rect.top - offset.y) * scale;

    // Make sure we're within the tileset bounds
    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);
      
      if (tileX >= 0 && tileX < tilesPerRow && tileY >= 0 && tileY < tilesPerRow) {
        const tileId = tileY * tilesPerRow + tileX;
        onTileSelect(tileId);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className={styles.tileSelector}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}; 