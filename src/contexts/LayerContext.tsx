import React, { createContext, useContext, useState, useCallback } from 'react';
import { MapItem, LayerType, TileLayerItem } from '../types/map';

interface LayerContextType {
  layers: MapItem[];
  selectedLayer: number;
  setSelectedLayer: (index: number) => void;
  setLayers: (layers: MapItem[]) => void;
  addLayer: (type: LayerType) => void;
  removeLayer: (index: number) => void;
  moveLayer: (fromIndex: number, toIndex: number) => void;
  updateLayer: (index: number, layer: MapItem) => void;
}

const LayerContext = createContext<LayerContextType | null>(null);

export const LayerProvider: React.FC<{
  children: React.ReactNode;
  initialLayers?: MapItem[];
}> = ({ children, initialLayers = [] }) => {
  // Helper function to create initial layer
  const createInitialLayer = (): MapItem => {
    return {
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
        tileData: new Array(50 * 50).fill(null).map(() => ({
          id: 0,
          flags: 0,
          skip: 0,
          reserved: 0
        })),
        name: 'Tile Layer 0'
      } as TileLayerItem
    };
  };

  const [layers, setLayers] = useState<MapItem[]>(() => {
    if (initialLayers.length > 0) {
      return initialLayers;
    }
    return [createInitialLayer()];
  });
  const [selectedLayer, setSelectedLayer] = useState<number>(0);

  const findFirstAvailableLayerNumber = (): number => {
    const usedNumbers = new Set<number>();
    layers.forEach(layer => {
      if (layer.parsed && 'name' in layer.parsed) {
        const match = layer.parsed.name.match(/^Tile Layer (\d+)$/);
        if (match) {
          usedNumbers.add(parseInt(match[1], 10));
        }
      }
    });
    let number = 0;
    while (usedNumbers.has(number)) {
      number++;
    }
    return number;
  };

  const createEmptyTileLayer = (type: LayerType): MapItem => {
    const layer: TileLayerItem = {
      type,
      flags: 0,
      version: 1,
      width: 50,
      height: 50,
      color: { r: 255, g: 255, b: 255, a: 255 },
      colorEnv: -1,
      colorEnvOffset: 0,
      image: -1,
      data: 0,
      tileData: new Array(50 * 50).fill(null).map(() => ({
        id: 0,
        flags: 0,
        skip: 0,
        reserved: 0
      })),
      name: `Tile Layer ${findFirstAvailableLayerNumber()}`
    };

    return {
      typeAndId: (type << 16) | layers.length,
      size: 0,
      data: new ArrayBuffer(0),
      parsed: layer
    };
  };

  const addLayer = useCallback((type: LayerType) => {
    const newLayer = createEmptyTileLayer(type);
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayer(layers.length);
  }, [layers.length]);

  const removeLayer = useCallback((index: number) => {
    if (layers.length <= 1) {
      console.warn('Cannot remove the last layer');
      return;
    }

    setLayers(prev => {
      const newLayers = [...prev];
      newLayers.splice(index, 1);
      // Update typeAndId for remaining layers
      newLayers.forEach((layer, i) => {
        if (layer.parsed && 'type' in layer.parsed) {
          layer.typeAndId = (layer.parsed.type << 16) | i;
        }
      });
      return newLayers;
    });

    setSelectedLayer(prev => {
      if (prev >= index) {
        return Math.max(0, prev - 1);
      }
      return prev;
    });
  }, []);

  const moveLayer = useCallback((fromIndex: number, toIndex: number) => {
    setLayers(prev => {
      const newLayers = [...prev];
      const [movedLayer] = newLayers.splice(fromIndex, 1);
      newLayers.splice(toIndex, 0, movedLayer);
      // Update typeAndId for all layers
      newLayers.forEach((layer, i) => {
        if (layer.parsed && 'type' in layer.parsed) {
          layer.typeAndId = (layer.parsed.type << 16) | i;
        }
      });
      return newLayers;
    });

    setSelectedLayer(prev => {
      if (prev === fromIndex) return toIndex;
      if (prev > fromIndex && prev <= toIndex) return prev - 1;
      if (prev < fromIndex && prev >= toIndex) return prev + 1;
      return prev;
    });
  }, []);

  const updateLayer = useCallback((index: number, layer: MapItem) => {
    setLayers(prev => {
      const newLayers = [...prev];
      newLayers[index] = layer;
      return newLayers;
    });
  }, []);

  return (
    <LayerContext.Provider value={{
      layers,
      selectedLayer,
      setSelectedLayer,
      setLayers,
      addLayer,
      removeLayer,
      moveLayer,
      updateLayer
    }}>
      {children}
    </LayerContext.Provider>
  );
};

export const useLayers = () => {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error('useLayers must be used within a LayerProvider');
  }
  return context;
}; 