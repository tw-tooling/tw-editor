import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapData, TileLayerItem, LayerType, MapItem } from '../types/map';
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
  const [tool, setTool] = useState<'select' | 'brush' | 'fill' | 'eraser'>('brush');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  const { selectedLayer, setLayers, layers, updateLayer } = useLayers();

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

    rendererRef.current = new MapRenderer(ctx, mapData);
    render();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    render();
  }, [render]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(Math.max(z * delta, 0.1), 10));
    } else {
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
          tool === 'eraser' ? 0 : undefined // Use tile ID 0 for eraser
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
          tool === 'eraser' ? 0 : undefined // Use tile ID 0 for eraser
        );
        render();
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDrawing(false);
  };

  const handleExport = useCallback(() => {
    MapExporter.downloadMap(mapData);
  }, [mapData]);

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