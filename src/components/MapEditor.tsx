import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, TileLayerItem, LayerType } from '../types/map';
import { EditorToolbar } from './EditorToolbar';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { MapRenderer } from '../renderer/MapRenderer';
import { MapExporter } from '../map/MapExporter';
import styles from './MapEditor.module.css';
import { LayerProvider, useLayers } from '../contexts/LayerContext';

interface MapEditorProps {
  mapData?: MapData;
}

const createDefaultMap = (): MapData => {
  // Create all layers from the example
  const layers = [
    // Game layer
    {
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.TILES,
        flags: 1,
        version: 1,
        width: 100,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: -1,  // game layer
        data: 0,
        tileData: new Array(100 * 50).fill(null).map(() => ({
          id: 0,
          flags: 0,
          skip: 0,
          reserved: 0
        })),
        name: 'Game Layer'
      } as TileLayerItem
    },
    // Front layer (grass)
    {
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.TILES,
        flags: 0,
        version: 1,
        width: 100,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: 0,  // grass_main
        data: 0,
        tileData: new Array(100 * 50).fill(null).map(() => ({
          id: 0,
          flags: 0,
          skip: 0,
          reserved: 0
        })),
        name: 'Front Layer'
      } as TileLayerItem
    },
    // Unhookable layer
    {
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.TILES,
        flags: 0,
        version: 1,
        width: 100,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: 1,  // generic_unhookable
        data: 0,
        tileData: new Array(100 * 50).fill(null).map(() => ({
          id: 0,
          flags: 0,
          skip: 0,
          reserved: 0
        })),
        name: 'Unhookable Layer'
      } as TileLayerItem
    },
    // Background layer (desert)
    {
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.TILES,
        flags: 0,
        version: 1,
        width: 100,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: 2,  // desert_main
        data: 0,
        tileData: new Array(100 * 50).fill(null).map(() => ({
          id: 0,
          flags: 0,
          skip: 0,
          reserved: 0
        })),
        name: 'Background Layer'
      } as TileLayerItem
    }
  ];

  return {
    header: {
      signature: new Uint8Array([68, 65, 84, 65]), // "DATA"
      version: 4,
      size: 0,
      swapLen: 0,
      numItemTypes: 1,
      numItems: layers.length,
      numData: 0,
      itemSize: 0,
      dataSize: 0
    },
    itemTypes: [{
      typeId: LayerType.TILES,
      start: 0,
      num: layers.length
    }],
    itemOffsets: new Array(layers.length).fill(0),
    dataOffsets: [],
    items: layers,
    data: []
  };
};

const MapEditorContent: React.FC<MapEditorProps> = ({ mapData: initialMapData }) => {
  const [mapData, setMapData] = useState(() => initialMapData || createDefaultMap());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'brush' | 'eraser'>('brush');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<{start: {x: number, y: number}, end: {x: number, y: number}} | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<{id: number, flags: number}[]>([]);

  const { selectedLayer, setLayers, layers, updateLayer } = useLayers();

  // Helper function to convert screen coordinates to tile coordinates
  const screenToTileCoords = useCallback((screenX: number, screenY: number) => {
    if (!rendererRef.current || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    const worldX = (canvasX - offset.x) / zoom;
    const worldY = (canvasY - offset.y) / zoom;
    return {
      x: Math.floor(worldX / 32), // Assuming 32px tile size
      y: Math.floor(worldY / 32)
    };
  }, [offset, zoom]);

  // Helper function to get tiles in selection
  const getSelectedTiles = useCallback(() => {
    if (!selection || !layers[selectedLayer]?.parsed) return [];
    const layer = layers[selectedLayer].parsed as TileLayerItem;
    const tiles: {id: number, flags: number}[] = [];
    
    const startX = Math.min(selection.start.x, selection.end.x);
    const endX = Math.max(selection.start.x, selection.end.x);
    const startY = Math.min(selection.start.y, selection.end.y);
    const endY = Math.max(selection.start.y, selection.end.y);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (x >= 0 && x < layer.width && y >= 0 && y < layer.height && layer.tileData) {
          const tile = layer.tileData[y * layer.width + x];
          tiles.push({ id: tile.id, flags: tile.flags });
        }
      }
    }
    return tiles;
  }, [selection, layers, selectedLayer]);

  // Initial sync of mapData to layers
  useEffect(() => {
    setLayers(mapData.items);
  }, []);

  // Keep mapData in sync with layers
  useEffect(() => {
    setMapData(prev => ({ ...prev, items: layers }));
  }, [layers]);

  // Update renderer when mapData changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateMapData(mapData);
      render();
    }
  }, [mapData]);

  const render = useCallback(() => {
    if (!rendererRef.current) return;
    rendererRef.current.render(zoom, offset.x, offset.y);
    
    // Draw selection rectangle if exists
    if (selection && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const tileSize = 32 * zoom;
        const startX = offset.x + selection.start.x * tileSize;
        const startY = offset.y + selection.start.y * tileSize;
        const width = (selection.end.x - selection.start.x + 1) * tileSize;
        const height = (selection.end.y - selection.start.y + 1) * tileSize;
        
        ctx.strokeStyle = 'rgba(0, 162, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, width, height);
        ctx.fillStyle = 'rgba(0, 162, 255, 0.1)';
        ctx.fillRect(startX, startY, width, height);
      }
    }
  }, [zoom, offset, selection]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    rendererRef.current = new MapRenderer(ctx, mapData);
    render();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    render();
  }, [render]);

  const handleWheel = (e: React.WheelEvent) => {
    // Always prevent browser zoom when ctrl is pressed
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      
      // Get canvas center in screen space
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const canvasCenterX = rect.width / 2;
      const canvasCenterY = rect.height / 2;

      // Calculate how the center point will move after zoom
      const oldZoom = zoom;
      const newZoom = Math.min(Math.max(oldZoom * delta, 0.1), 10);
      
      // Convert center point from screen space to world space
      const worldX = (canvasCenterX - offset.x) / oldZoom;
      const worldY = (canvasCenterY - offset.y) / oldZoom;
      
      // Calculate new offset to keep the world point under the screen point
      const newOffset = {
        x: canvasCenterX - worldX * newZoom,
        y: canvasCenterY - worldY * newZoom
      };

      setZoom(newZoom);
      setOffset(newOffset);
    } else if (e.shiftKey) {
      // Horizontal scroll when shift is pressed
      e.preventDefault();
      setOffset(prev => ({
        x: prev.x - e.deltaY,  // Use deltaY for horizontal scroll
        y: prev.y
      }));
    } else {
      // Normal vertical scroll
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  useEffect(() => {
    // Prevent browser zoom on the canvas
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', preventZoom, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', preventZoom);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left click for panning
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (tool === 'select') {
      if (e.button === 0) { // Left click for selection
        const tileCoords = screenToTileCoords(e.clientX, e.clientY);
        if (tileCoords) {
          setIsSelecting(true);
          setSelection({
            start: tileCoords,
            end: tileCoords
          });
        }
      } else if (e.button === 2 && selectedTiles.length > 0) { // Right click for insertion
        const tileCoords = screenToTileCoords(e.clientX, e.clientY);
        if (tileCoords && selection) {
          const activeLayer = layers[selectedLayer];
          if (activeLayer?.parsed && 'tileData' in activeLayer.parsed) {
            const updatedLayer = { ...activeLayer };
            const layer = updatedLayer.parsed as TileLayerItem;
            
            // Calculate dimensions of the selection
            const selectionWidth = Math.abs(selection.end.x - selection.start.x) + 1;
            
            // Paste the selected tiles
            selectedTiles.forEach((tile, i) => {
              const x = tileCoords.x + (i % selectionWidth);
              const y = tileCoords.y + Math.floor(i / selectionWidth);
              
              if (x >= 0 && x < layer.width && y >= 0 && y < layer.height && layer.tileData) {
                const index = y * layer.width + x;
                layer.tileData[index] = {
                  ...layer.tileData[index],
                  id: tile.id,
                  flags: tile.flags
                };
              }
            });
            
            updateLayer(selectedLayer, updatedLayer);
          }
        }
      }
    } else if (e.button === 0 && (tool === 'brush' || tool === 'eraser')) {
      setIsDrawing(true);
      const activeLayer = layers[selectedLayer];
      
      if (!activeLayer) {
        console.warn('No active layer found at index:', selectedLayer);
        return;
      }

      if (activeLayer?.parsed && 'type' in activeLayer.parsed && activeLayer.parsed.type === LayerType.TILES) {
        const updatedLayer = { ...activeLayer };
        rendererRef.current?.render(zoom, offset.x, offset.y);
        rendererRef.current?.handleMouseDown(
          e.clientX, 
          e.clientY, 
          activeLayer.parsed as TileLayerItem,
          (updatedTileLayer) => {
            updatedLayer.parsed = updatedTileLayer;
            updateLayer(selectedLayer, updatedLayer);
          },
          tool === 'eraser' ? 0 : undefined
        );
        render();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      setOffset(newOffset);
    } else if (tool === 'select' && isSelecting) {
      const tileCoords = screenToTileCoords(e.clientX, e.clientY);
      if (tileCoords) {
        setSelection(prev => prev ? {
          start: prev.start,
          end: tileCoords
        } : null);
      }
    } else if (isDrawing) {
      const activeLayer = layers[selectedLayer];
      if (activeLayer?.parsed && 'type' in activeLayer.parsed && activeLayer.parsed.type === LayerType.TILES) {
        const updatedLayer = { ...activeLayer };
        rendererRef.current?.render(zoom, offset.x, offset.y);
        rendererRef.current?.handleMouseDown(
          e.clientX, 
          e.clientY, 
          activeLayer.parsed as TileLayerItem,
          (updatedTileLayer) => {
            updatedLayer.parsed = updatedTileLayer;
            updateLayer(selectedLayer, updatedLayer);
          },
          tool === 'eraser' ? 0 : undefined
        );
        render();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    setIsDrawing(false);
    
    if (tool === 'select' && isSelecting) {
      setIsSelecting(false);
      if (selection) {
        const tiles = getSelectedTiles();
        setSelectedTiles(tiles);
      }
    }
  };

  const handleExport = useCallback(() => {
    MapExporter.downloadMap(mapData);
  }, [mapData]);

  // Prevent context menu on right click
  useEffect(() => {
    const canvas = canvasRef.current;
    const preventDefault = (e: Event) => e.preventDefault();
    
    if (canvas) {
      canvas.addEventListener('contextmenu', preventDefault);
    }
    
    return () => {
      if (canvas) {
        canvas.removeEventListener('contextmenu', preventDefault);
      }
    };
  }, []);

  return (
    <div className={styles.editor}>
      <EditorToolbar 
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomChange={setZoom}
        onExport={handleExport}
      />
      
      <div className={styles.workspace}>
        <div className={styles.leftPanel}>
          <LayerPanel />
        </div>
        
        <div className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
        
        <div className={styles.rightPanel}>
          <PropertiesPanel
            selectedLayer={selectedLayer}
            mapData={mapData}
          />
        </div>
      </div>
    </div>
  );
};

export const MapEditor: React.FC<MapEditorProps> = (props) => {
  return (
    <LayerProvider initialLayers={props.mapData?.items || []}>
      <MapEditorContent {...props} />
    </LayerProvider>
  );
}; 