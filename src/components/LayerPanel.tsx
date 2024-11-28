import React, { useEffect } from 'react';
import { useLayers } from '../contexts/LayerContext';
import { LayerType } from '../types/map';
import styles from './LayerPanel.module.css';

export const LayerPanel: React.FC = () => {
  const { 
    layers, 
    selectedLayer, 
    setSelectedLayer, 
    addLayer, 
    removeLayer, 
    moveLayer 
  } = useLayers();

  // Debug logging
  useEffect(() => {
    console.log('Layers:', layers);
    console.log('Selected layer:', selectedLayer);
  }, [layers, selectedLayer]);

  const handleAddLayer = () => {
    const type = LayerType.TILES; // Default to tile layer for now
    addLayer(type);
  };

  const handleLayerDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleLayerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleLayerDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (sourceIndex !== targetIndex) {
      moveLayer(sourceIndex, targetIndex);
    }
  };

  const getLayerIcon = (typeId: number) => {
    const type = typeId >> 16;
    switch (type) {
      case LayerType.TILES:
        return 'fa-th';
      case LayerType.QUADS:
        return 'fa-vector-square';
      case LayerType.GAME:
        return 'fa-gamepad';
      default:
        return 'fa-layer-group';
    }
  };

  const getLayerName = (typeId: number, index: number) => {
    const type = typeId >> 16;
    switch (type) {
      case LayerType.TILES:
        return `Tile Layer ${index}`;
      case LayerType.QUADS:
        return `Quad Layer ${index}`;
      case LayerType.GAME:
        return 'Game Layer';
      default:
        return `Layer ${index}`;
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Layers ({layers.length})</h3>
        <div className={styles.toolbox}>
          <button 
            className={styles.addButton}
            onClick={handleAddLayer}
            title="Add Layer"
          >
            <i className="fas fa-plus" />
          </button>
          <button 
            className={styles.addButton}
            onClick={() => removeLayer(selectedLayer)}
            disabled={layers.length <= 1}
            title="Remove Layer"
          >
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>

      <div className={styles.layerList}>
        {layers.map((layer, index) => {
          const layerData = layer.parsed as TileLayerItem;
          return (
            <div
              key={index}
              className={`${styles.layer} ${selectedLayer === index ? styles.selected : ''}`}
              onClick={() => setSelectedLayer(index)}
              draggable
              onDragStart={(e) => handleLayerDragStart(e, index)}
              onDragOver={handleLayerDragOver}
              onDrop={(e) => handleLayerDrop(e, index)}
            >
              <div className={styles.layerVisibility}>
                <i className="fas fa-eye" />
              </div>
              <div className={styles.layerContent}>
                <i className={`fas ${getLayerIcon(layer.typeAndId)}`} />
                <span>{layerData.name || `Layer ${index + 1}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 