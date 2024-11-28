import React, { useState, useEffect } from 'react';
import { MapData, TileLayerItem } from '../types/map';
import { useLayers } from '../contexts/LayerContext';
import styles from './PropertiesPanel.module.css';

interface PropertiesProps {
  selectedLayer: number;
  mapData: MapData;
}

// Fixed image options matching the example
const IMAGE_OPTIONS = [
  { id: -1, name: "game" },
  { id: 0, name: "grass_main" },
  { id: 1, name: "generic_unhookable" },
  { id: 2, name: "desert_main" }
];

export const PropertiesPanel: React.FC<PropertiesProps> = ({
  selectedLayer,
  mapData
}) => {
  const { updateLayer, layers } = useLayers();
  const [layerName, setLayerName] = useState('');

  const activeLayer = layers[selectedLayer];
  const layerData = activeLayer?.parsed as TileLayerItem;

  useEffect(() => {
    if (layerData) {
      setLayerName(layerData.name);
    }
  }, [layerData]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setLayerName(newName);
    
    if (activeLayer && layerData) {
      const updatedLayer = { ...activeLayer };
      updatedLayer.parsed = {
        ...layerData,
        name: newName
      };
      updateLayer(selectedLayer, updatedLayer);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newImage = parseInt(e.target.value);
    
    if (activeLayer && layerData) {
      const updatedLayer = { ...activeLayer };
      updatedLayer.parsed = {
        ...layerData,
        image: newImage
      };
      updateLayer(selectedLayer, updatedLayer);
    }
  };

  if (!activeLayer || !layerData) {
    return (
      <div className={styles.panel}>
        <h3>Properties</h3>
        <div className={styles.noLayer}>No layer selected</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <h3>Properties</h3>
      
      <div className={styles.propertyGroup}>
        <label>Name:</label>
        <input
          type="text"
          value={layerName}
          onChange={handleNameChange}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyGroup}>
        <label>Image:</label>
        <select
          value={layerData.image}
          onChange={handleImageChange}
          className={styles.input}
        >
          {IMAGE_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.propertyGroup}>
        <label>Size:</label>
        <div className={styles.size}>
          <span>Width: {layerData.width}</span>
          <span>Height: {layerData.height}</span>
        </div>
      </div>
    </div>
  );
}; 