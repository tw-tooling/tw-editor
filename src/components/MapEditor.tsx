import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, TileLayerItem, LayerType } from '../types/map';
import { EditorToolbar } from './EditorToolbar';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { MapRenderer } from '../renderer/MapRenderer';
import styles from './MapEditor.module.css';
import { LayerProvider, useLayers } from '../contexts/LayerContext';

interface MapEditorProps {
  mapData?: MapData;
}

const createDefaultMap = (): MapData => {
  // Create a default tile layer with some tiles
  const defaultTileData = new Array(50 * 50).fill(null).map((_, index) => ({
    id: Math.random() < 0.2 ? Math.floor(Math.random() * 5) + 1 : 0, // 20% chance of having a tile
    flags: 0,
    skip: 0,
    reserved: 0
  }));

  const defaultLayer: MapItem = {
    typeAndId: (LayerType.TILES << 16) | 0,
    size: 0,
    data: new ArrayBuffer(0),
    parsed: {
      type: LayerType.TILES,
      flags: 0,
      version: 1,
      width: 50,
      height: 50,
      color: { r: 255, g: 255, b: 255, a: 255 },
      colorEnv: -1,
      colorEnvOffset: 0,
      image: -1,
      data: 0,
      tileData: defaultTileData,
      name: 'Tile Layer 1'
    } as TileLayerItem
  };

  return {
    header: {
      signature: new Uint8Array([68, 65, 84, 65]), // "DATA"
      version: 4,
      size: 0,
      swapLen: 0,
      numItemTypes: 1,
      numItems: 1,
      numData: 0,
      itemSize: 0,
      dataSize: 0
    },
    itemTypes: [{
      typeId: LayerType.TILES,
      start: 0,
      num: 1
    }],
    itemOffsets: [0],
    dataOffsets: [],
    items: [defaultLayer],
    data: []
  };
};

const MapEditorContent: React.FC<MapEditorProps> = ({ mapData: initialMapData }) => {
  const [mapData, setMapData] = useState(() => {
    const data = initialMapData || createDefaultMap();
    return data;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MapRenderer | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'brush' | 'fill'>('brush');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  // Get the layer context
  const { selectedLayer, setLayers, layers } = useLayers();

  // Keep layer context in sync with mapData
  useEffect(() => {
    if (mapData.items.length > 0) {
      setLayers(mapData.items);
    }
  }, [mapData.items, setLayers]);

  // Keep mapData in sync with layer context
  useEffect(() => {
    if (layers.length > 0) {
      setMapData(prev => ({
        ...prev,
        items: layers
      }));
    }
  }, [layers]);

  // Debug logging
  useEffect(() => {
    console.log('Selected layer:', selectedLayer);
    console.log('Map data items:', mapData.items);
    console.log('Active layer:', mapData.items[selectedLayer]);
    console.log('Layer context layers:', layers);
  }, [selectedLayer, mapData, layers]);

  // Update renderer when mapData changes
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateMapData(mapData);
      render();
    }
  }, [mapData]);

  // Update renderer when selected layer changes
  useEffect(() => {
    if (rendererRef.current) {
      render();
    }
  }, [selectedLayer]);

  const render = useCallback(() => {
    if (!rendererRef.current) return;
    rendererRef.current.render(zoom, offset.x, offset.y);
  }, [zoom, offset]);

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

    // Initialize renderer
    rendererRef.current = new MapRenderer(ctx, mapData);
    
    // Ensure initial render
    requestAnimationFrame(() => {
      rendererRef.current?.render(zoom, offset.x, offset.y);
    });

    return () => window.removeEventListener('resize', updateSize);
  }, [mapData]);

  useEffect(() => {
    render();
  }, [render]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(Math.max(z * delta, 0.1), 10));
    } else {
      // Pan with wheel
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    } else if (e.button === 0 && tool === 'brush') {
      setIsDrawing(true);
      const activeLayer = mapData.items[selectedLayer];
      
      if (!activeLayer) {
        console.warn('No active layer found at index:', selectedLayer);
        return;
      }

      if (activeLayer?.parsed && 'type' in activeLayer.parsed && activeLayer.parsed.type === LayerType.TILES) {
        const updatedLayer = { ...activeLayer };
        rendererRef.current?.handleMouseDown(
          e.clientX, 
          e.clientY, 
          activeLayer.parsed as TileLayerItem,
          (updatedTileLayer) => {
            updatedLayer.parsed = updatedTileLayer;
            const newItems = [...mapData.items];
            newItems[selectedLayer] = updatedLayer;
            setMapData(prev => ({
              ...prev,
              items: newItems
            }));
          }
        );
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isDrawing) {
      const activeLayer = mapData.items[selectedLayer];
      if (activeLayer?.parsed && 'type' in activeLayer.parsed && activeLayer.parsed.type === LayerType.TILES) {
        const updatedLayer = { ...activeLayer };
        rendererRef.current?.handleMouseDown(
          e.clientX, 
          e.clientY, 
          activeLayer.parsed as TileLayerItem,
          (updatedTileLayer) => {
            updatedLayer.parsed = updatedTileLayer;
            const newItems = [...mapData.items];
            newItems[selectedLayer] = updatedLayer;
            setMapData({ ...mapData, items: newItems });
          }
        );
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDrawing(false);
  };

  return (
    <div className={styles.editor}>
      <EditorToolbar 
        tool={tool}
        onToolChange={setTool}
        zoom={zoom}
        onZoomChange={setZoom}
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

// Wrapper component to handle context
export const MapEditor: React.FC<MapEditorProps> = (props) => {
  return (
    <LayerProvider initialLayers={props.mapData?.items || []}>
      <MapEditorContent {...props} />
    </LayerProvider>
  );
}; 