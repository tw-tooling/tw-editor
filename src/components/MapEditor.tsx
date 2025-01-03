import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, TileLayerItem, LayerType } from '../types/map';
import { EditorToolbar } from './EditorToolbar';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TileSelector } from './TileSelector';
import { MapRenderer } from '../renderer/MapRenderer';
import { MapExporter } from '../map/MapExporter';
import styles from './MapEditor.module.css';
import { LayerProvider, useLayers } from '../contexts/LayerContext';

interface MapEditorProps {
  mapData?: MapData;
}

interface ToolState {
  tool: 'select' | 'brush';
  mode: 'primary' | 'secondary';
}

const createDefaultMap = (): MapData => {
  // Create all layers from the example
  const layers = [
    // Game layer
    {
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.GAME,
        flags: 1,
        version: 1,
        width: 100,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: 'DDNet',  // DDNet game layer
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
        image: 'grass_main',
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
        image: 'generic_unhookable',
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
    // Background layer
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
        image: 'desert_main',
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

type MobileView = 'draw' | 'layers' | 'properties';

const TILE_SIZE = 64; // Define tile size constant

const MapEditorContent: React.FC<MapEditorProps> = ({ mapData: initialMapData }) => {
  const [mapData, setMapData] = useState(() => initialMapData || createDefaultMap());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const [zoom, setZoom] = useState(1);
  const [toolState, setToolState] = useState<ToolState>({ tool: 'brush', mode: 'primary' });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [selection, setSelection] = useState<{start: {x: number, y: number}, end: {x: number, y: number}} | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<{id: number, flags: number}[]>([]);
  const [previewPosition, setPreviewPosition] = useState<{x: number, y: number} | null>(null);
  const [touchStartDistance, setTouchStartDistance] = useState<number | null>(null);
  const [touchStartZoom, setTouchStartZoom] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('draw');
  const [touchStartCenter, setTouchStartCenter] = useState<{x: number, y: number} | null>(null);
  const [isTouchInput, setIsTouchInput] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState(1);

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
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
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
    if (!canvasRef.current || !rendererRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    rendererRef.current.render(zoom, offset.x, offset.y);

    // Apply transformations for preview rendering
    ctx.setTransform(
      zoom, 0,
      0, zoom,
      offset.x,
      offset.y
    );

    // Draw active selection if selecting
    if (selection && (isSelecting || selectedTiles.length === 0)) {
      const startX = selection.start.x * TILE_SIZE;
      const startY = selection.start.y * TILE_SIZE;
      const width = (selection.end.x - selection.start.x + 1) * TILE_SIZE;
      const height = (selection.end.y - selection.start.y + 1) * TILE_SIZE;
      
      ctx.strokeStyle = 'rgba(0, 162, 255, 0.8)';
      ctx.lineWidth = 2 / zoom;  // Scale line width with zoom
      ctx.strokeRect(startX, startY, width, height);
      ctx.fillStyle = 'rgba(0, 162, 255, 0.1)';
      ctx.fillRect(startX, startY, width, height);
    }

    // Draw preview of selected tiles
    if (!isTouchInput && previewPosition && selectedTiles.length > 0 && selection && !isSelecting) {
      const selectionWidth = Math.abs(selection.end.x - selection.start.x) + 1;
      const selectionHeight = Math.abs(selection.end.y - selection.start.y) + 1;
      
      // Get the current layer
      const activeLayer = layers[selectedLayer]?.parsed as TileLayerItem;
      if (!activeLayer) return;

      // Calculate preview position in world coordinates
      const previewX = previewPosition.x * TILE_SIZE;
      const previewY = previewPosition.y * TILE_SIZE;

      // Draw preview outline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2 / zoom;  // Scale line width with zoom
      ctx.strokeRect(
        previewX,
        previewY,
        selectionWidth * TILE_SIZE,
        selectionHeight * TILE_SIZE
      );

      // Draw preview fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(
        previewX,
        previewY,
        selectionWidth * TILE_SIZE,
        selectionHeight * TILE_SIZE
      );

      // Draw preview tiles with semi-transparency
      selectedTiles.forEach((tile, i) => {
        if (rendererRef.current && tile.id !== 0) {
          const x = previewPosition.x + (i % selectionWidth);
          const y = previewPosition.y + Math.floor(i / selectionWidth);
          
          ctx.globalAlpha = 0.5;
          rendererRef.current.renderPreviewTile(
            ctx,
            {
              ...tile,
              skip: 0,
              reserved: 0
            },
            x * TILE_SIZE,
            y * TILE_SIZE,
            activeLayer,
            TILE_SIZE
          );
          ctx.globalAlpha = 1.0;
        }
      });
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [zoom, offset, selection, isSelecting, selectedTiles, previewPosition, isTouchInput, layers, selectedLayer]);

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

  // Helper function to insert tiles at position
  const insertTilesAtPosition = useCallback((tileCoords: {x: number, y: number}) => {
    if (!selection || selectedTiles.length === 0) return;
    
    const activeLayer = layers[selectedLayer];
    if (!activeLayer?.parsed || !('tileData' in activeLayer.parsed)) return;

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
  }, [layers, selectedLayer, selection, selectedTiles, updateLayer]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Reset to primary mode on any mouse click
    setToolState(prev => ({ ...prev, mode: 'primary' }));

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left click for panning
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (toolState.tool === 'select') {
      if (e.button === 0) { // Left click for selection
        const tileCoords = screenToTileCoords(e.clientX, e.clientY);
        if (tileCoords) {
          setIsSelecting(true);
          setPreviewPosition(null);
          setSelection({
            start: tileCoords,
            end: tileCoords
          });
        }
      } else if (e.button === 2 && selectedTiles.length > 0) { // Right click for insertion
        setIsInserting(true);
        const tileCoords = screenToTileCoords(e.clientX, e.clientY);
        if (tileCoords) {
          insertTilesAtPosition(tileCoords);
        }
      }
    } else if (toolState.tool === 'brush' && (e.button === 0 || e.button === 2)) {
      setIsDrawing(true);
      setIsErasing(e.button === 2);
      const activeLayer = layers[selectedLayer];
      
      if (!activeLayer) {
        console.warn('No active layer found at index:', selectedLayer);
        return;
      }

      if (activeLayer?.parsed && 'type' in activeLayer.parsed && 
          (activeLayer.parsed.type === LayerType.TILES || activeLayer.parsed.type === LayerType.GAME)) {
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
          e.button === 2 ? 0 : undefined // Use tile ID 0 for erasing on right click
        );
        render();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setIsTouchInput(false);
    if (isDragging) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      setOffset(newOffset);
    } else if (toolState.tool === 'select') {
      const tileCoords = screenToTileCoords(e.clientX, e.clientY);
      if (tileCoords) {
        if (isSelecting) {
          setSelection(prev => prev ? {
            start: prev.start,
            end: tileCoords
          } : null);
        } else if (isInserting) {
          insertTilesAtPosition(tileCoords);
          setPreviewPosition(tileCoords);
        } else if (selectedTiles.length > 0) {
          setPreviewPosition(tileCoords);
        }
      }
    } else if (isDrawing && toolState.tool === 'brush') {
      const activeLayer = layers[selectedLayer];
      if (activeLayer?.parsed && 'type' in activeLayer.parsed && 
          (activeLayer.parsed.type === LayerType.TILES || activeLayer.parsed.type === LayerType.GAME)) {
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
          isErasing ? 0 : undefined // Use tile ID 0 for erasing
        );
        render();
      }
    }
    if (toolState.tool === 'select' && toolState.mode === 'secondary' && selectedTiles.length > 0) {
      const tileCoords = screenToTileCoords(e.clientX, e.clientY);
      if (tileCoords) {
        setPreviewPosition(tileCoords);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    setIsDrawing(false);
    setIsErasing(false);
    setIsInserting(false);
    
    if (toolState.tool === 'select' && isSelecting) {
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

  const handleMouseLeave = () => {
    setPreviewPosition(null);
    setIsInserting(false);
    setIsDrawing(false);
    setIsErasing(false);
    setIsTouchInput(false);
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };

  const handleToolChange = (newTool: 'select' | 'brush', mode: 'primary' | 'secondary') => {
    setToolState({ tool: newTool, mode });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouchInput(true);
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      
      if (distance !== null && center !== null) {
        setTouchStartDistance(distance);
        setTouchStartZoom(zoom);
        setTouchStartCenter(center);
        setIsDragging(true);
        setDragStart({
          x: center.x - offset.x,
          y: center.y - offset.y
        });
      }
    } else if (e.touches.length === 1) {
      // Single finger - handle based on current tool and mode
      if (toolState.tool === 'brush') {
        setIsDrawing(true);
        setIsErasing(toolState.mode === 'secondary');
        const activeLayer = layers[selectedLayer];
        
        if (activeLayer?.parsed && 'type' in activeLayer.parsed && 
            (activeLayer.parsed.type === LayerType.TILES || activeLayer.parsed.type === LayerType.GAME)) {
          const updatedLayer = { ...activeLayer };
          rendererRef.current?.render(zoom, offset.x, offset.y);
          rendererRef.current?.handleMouseDown(
            e.touches[0].clientX,
            e.touches[0].clientY,
            activeLayer.parsed as TileLayerItem,
            (updatedTileLayer) => {
              updatedLayer.parsed = updatedTileLayer;
              updateLayer(selectedLayer, updatedLayer);
            },
            toolState.mode === 'secondary' ? 0 : undefined
          );
          render();
        }
      } else if (toolState.tool === 'select') {
        const tileCoords = screenToTileCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (tileCoords) {
          if (toolState.mode === 'primary') {
            // Selection mode
            setIsSelecting(true);
            setPreviewPosition(null);
            setSelection({
              start: tileCoords,
              end: tileCoords
            });
          } else {
            // Insert mode - no preview for touch
            if (selectedTiles.length > 0) {
              setIsInserting(true);
              setPreviewPosition(null);
              insertTilesAtPosition(tileCoords);
            }
          }
        }
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches);
      
      if (distance !== null && center !== null && touchStartDistance && touchStartZoom && touchStartCenter) {
        const scale = distance / touchStartDistance;
        const newZoom = Math.min(Math.max(touchStartZoom * scale, 0.1), 10);
        
        const newOffset = {
          x: center.x - (touchStartCenter.x - offset.x) * (newZoom / touchStartZoom),
          y: center.y - (touchStartCenter.y - offset.y) * (newZoom / touchStartZoom)
        };

        setZoom(newZoom);
        setOffset(newOffset);
        setTouchStartDistance(distance);
        setTouchStartZoom(zoom);
        setTouchStartCenter(center);
        setIsDragging(true);
        setDragStart({
          x: center.x - offset.x,
          y: center.y - offset.y
        });
      }
    } else if (e.touches.length === 1) {
      // Handle single finger based on tool and mode
      if (toolState.tool === 'brush' && isDrawing) {
        const activeLayer = layers[selectedLayer];
        if (activeLayer?.parsed && 'type' in activeLayer.parsed && 
            (activeLayer.parsed.type === LayerType.TILES || activeLayer.parsed.type === LayerType.GAME)) {
          const updatedLayer = { ...activeLayer };
          rendererRef.current?.render(zoom, offset.x, offset.y);
          rendererRef.current?.handleMouseDown(
            e.touches[0].clientX,
            e.touches[0].clientY,
            activeLayer.parsed as TileLayerItem,
            (updatedTileLayer) => {
              updatedLayer.parsed = updatedTileLayer;
              updateLayer(selectedLayer, updatedLayer);
            },
            toolState.mode === 'secondary' ? 0 : undefined
          );
          render();
        }
      } else if (toolState.tool === 'select') {
        const tileCoords = screenToTileCoords(e.touches[0].clientX, e.touches[0].clientY);
        if (tileCoords) {
          if (toolState.mode === 'primary' && isSelecting) {
            // Update selection area
            setSelection(prev => prev ? {
              start: prev.start,
              end: tileCoords
            } : null);
          } else if (toolState.mode === 'secondary' && isInserting) {
            // Insert without preview for touch
            insertTilesAtPosition(tileCoords);
          }
        }
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsDrawing(false);
    setIsErasing(false);
    setIsInserting(false);
    if (isSelecting) {
      setIsSelecting(false);
      if (selection) {
        const tiles = getSelectedTiles();
        setSelectedTiles(tiles);
      }
    }
    setTouchStartDistance(null);
    setTouchStartZoom(null);
    setTouchStartCenter(null);
    // Don't reset isTouchInput here to prevent preview flicker
  };

  const handleTileSelect = useCallback((tileId: number) => {
    setSelectedTileId(tileId);
    if (rendererRef.current) {
      rendererRef.current.setSelectedTileId(tileId);
    }
  }, []);

  const renderMobileNavigation = () => {
    return (
      <div className={styles.bottomNav}>
        <button
          className={`${styles.bottomNavButton} ${mobileView === 'layers' ? styles.active : ''}`}
          onClick={() => setMobileView(mobileView === 'layers' ? 'draw' : 'layers')}
        >
          <i className="fas fa-layers" />
          <span>Layers</span>
        </button>
        <button
          className={`${styles.bottomNavButton} ${mobileView === 'draw' ? styles.active : ''}`}
          onClick={() => setMobileView('draw')}
        >
          <i className="fas fa-paint-brush" />
          <span>Draw</span>
        </button>
        <button
          className={`${styles.bottomNavButton} ${mobileView === 'properties' ? styles.active : ''}`}
          onClick={() => setMobileView(mobileView === 'properties' ? 'draw' : 'properties')}
        >
          <i className="fas fa-cog" />
          <span>Properties</span>
        </button>
      </div>
    );
  };

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          setToolState({ tool: 'select', mode: 'primary' });
          break;
        case '2':
          setToolState({ tool: 'brush', mode: 'primary' });
          setPreviewPosition(null);
          break;
        case '0':
          handleExport();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleExport]);

  // Remove the global touch event prevention
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Only prevent on canvas
    canvas.addEventListener('touchmove', preventDefault, { passive: false });
    canvas.addEventListener('touchstart', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('touchmove', preventDefault);
      canvas.removeEventListener('touchstart', preventDefault);
    };
  }, []);

  return (
    <div className={styles.editor}>
      <EditorToolbar 
        tool={toolState.tool}
        mode={toolState.mode}
        onToolChange={handleToolChange}
        zoom={zoom}
        onZoomChange={setZoom}
        onExport={handleExport}
        shortcuts={{
          select: '1',
          brush: '2',
          export: '0'
        }}
      />
      
      <div className={styles.workspace}>
        <div className={`${styles.leftPanel} ${mobileView === 'layers' ? styles.visible : ''}`}>
          <LayerPanel />
          {toolState.tool === 'brush' && (
            <TileSelector
              selectedTileId={selectedTileId}
              onTileSelect={handleTileSelect}
            />
          )}
        </div>
        
        <div className={styles.canvasContainer}>
          <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${styles[toolState.tool]} ${styles[toolState.mode]} ${isErasing ? styles.erasing : ''} ${isDrawing ? styles.drawing : ''} ${isSelecting ? styles.selecting : ''} ${isInserting ? styles.inserting : ''} ${isDragging ? styles.dragging : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        
        <div className={`${styles.rightPanel} ${mobileView === 'properties' ? styles.visible : ''}`}>
          <PropertiesPanel
            selectedLayer={selectedLayer}
            mapData={mapData}
          />
        </div>

        {renderMobileNavigation()}
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