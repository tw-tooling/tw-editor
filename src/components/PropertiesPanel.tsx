import React, { useState, useEffect } from 'react';
import { MapData, TileLayerItem } from '../types/map';
import { useLayers } from '../contexts/LayerContext';
import styles from './PropertiesPanel.module.css';

interface PropertiesProps {
  selectedLayer: number;
  mapData: MapData;
}

export const PropertiesPanel: React.FC<PropertiesProps> = ({
  selectedLayer,
  mapData
}) => {
  const { updateLayer, layers } = useLayers();
  const [layerName, setLayerName] = useState('');
  const [color, setColor] = useState({ r: 255, g: 255, b: 255, a: 255 });

  const activeLayer = layers[selectedLayer];
  const layerData = activeLayer?.parsed as TileLayerItem;

  useEffect(() => {
    if (layerData) {
      setLayerName(layerData.name);
      setColor(layerData.color);
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

  const handleColorChange = (component: 'r' | 'g' | 'b' | 'a', value: number) => {
    const newColor = { ...color, [component]: value };
    setColor(newColor);

    if (activeLayer && layerData) {
      const updatedLayer = { ...activeLayer };
      updatedLayer.parsed = {
        ...layerData,
        color: newColor
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
        <label>Color:</label>
        <div className={styles.colorInputs}>
          <div>
            <label>R:</label>
            <input
              type="number"
              min="0"
              max="255"
              value={color.r}
              onChange={(e) => handleColorChange('r', parseInt(e.target.value))}
              className={styles.colorInput}
            />
          </div>
          <div>
            <label>G:</label>
            <input
              type="number"
              min="0"
              max="255"
              value={color.g}
              onChange={(e) => handleColorChange('g', parseInt(e.target.value))}
              className={styles.colorInput}
            />
          </div>
          <div>
            <label>B:</label>
            <input
              type="number"
              min="0"
              max="255"
              value={color.b}
              onChange={(e) => handleColorChange('b', parseInt(e.target.value))}
              className={styles.colorInput}
            />
          </div>
          <div>
            <label>A:</label>
            <input
              type="number"
              min="0"
              max="255"
              value={color.a}
              onChange={(e) => handleColorChange('a', parseInt(e.target.value))}
              className={styles.colorInput}
            />
          </div>
        </div>
        <div 
          className={styles.colorPreview} 
          style={{ 
            backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})` 
          }}
        />
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