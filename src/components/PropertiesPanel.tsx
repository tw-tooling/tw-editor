import React from 'react';
import { MapData } from '../types/map';
import styles from './PropertiesPanel.module.css';

interface PropertiesPanelProps {
  selectedLayer: number | null;
  mapData?: MapData;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedLayer,
  mapData,
}) => {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Properties</h3>
      </div>
      <div className={styles.content}>
        {selectedLayer !== null ? (
          <div>Selected Layer: {selectedLayer}</div>
        ) : (
          <div className={styles.placeholder}>
            Select a layer to view properties
          </div>
        )}
      </div>
    </div>
  );
}; 