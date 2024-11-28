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
    const isGameLayer = layers.length === 0;
    const layer: TileLayerItem = {
      type: LayerType.TILES,  // Always TILES type
      flags: isGameLayer ? 1 : 0,  // 1 for game layer, 0 for others
      version: 1,
      width: 100,  // Fixed width 100
      height: 50,  // Fixed height 50
      color: { r: 255, g: 255, b: 255, a: 255 },  // Always white
      colorEnv: -1,
      colorEnvOffset: 0,
      image: isGameLayer ? -1 : layers.length - 1,  // -1 for game layer, index for others
      data: 0,
      tileData: new Array(100 * 50).fill(null).map(() => ({
        id: 0,
        flags: 0,
        skip: 0,
        reserved: 0
      })),
      name: isGameLayer ? 'Game Layer' : `Tile Layer ${findFirstAvailableLayerNumber()}`
    };

    return {
      typeAndId: (LayerType.TILES << 16) | layers.length,
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
    setLayers(prev => {
      if (prev.length <= 1) {
        console.warn('Cannot remove the last layer');
        return prev;
      }

      const newLayers = [...prev];
      newLayers.splice(index, 1);

      // Update typeAndId for remaining layers
      newLayers.forEach((layer, i) => {
        if (layer.parsed && 'type' in layer.parsed) {
          layer.typeAndId = (layer.parsed.type << 16) | i;
        }
      });

      // Update selected layer before returning new layers
      if (selectedLayer >= newLayers.length) {
        setSelectedLayer(newLayers.length - 1);
      } else if (selectedLayer === index) {
        setSelectedLayer(Math.max(0, index - 1));
      }

      return newLayers;
    });
  }, [selectedLayer]);

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

      // Update selected layer
      if (selectedLayer === fromIndex) {
        setSelectedLayer(toIndex);
      } else if (selectedLayer > fromIndex && selectedLayer <= toIndex) {
        setSelectedLayer(selectedLayer - 1);
      } else if (selectedLayer < fromIndex && selectedLayer >= toIndex) {
        setSelectedLayer(selectedLayer + 1);
      }

      return newLayers;
    });
  }, [selectedLayer]);

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