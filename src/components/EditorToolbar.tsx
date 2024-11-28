import React from 'react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  tool: 'select' | 'brush';
  onToolChange: (tool: 'select' | 'brush') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onExport: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  tool,
  onToolChange,
  zoom,
  onZoomChange,
  onExport
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          className={`${styles.tool} ${tool === 'select' ? styles.active : ''}`}
          onClick={() => onToolChange('select')}
          title="Select Tool"
        >
          <i className="fas fa-mouse-pointer" />
        </button>
        <button
          className={`${styles.tool} ${tool === 'brush' ? styles.active : ''}`}
          onClick={() => onToolChange('brush')}
          title="Brush Tool (Right click to erase)"
        >
          <i className="fas fa-paint-brush" />
        </button>
      </div>

      <div className={styles.toolGroup}>
        <button
          className={styles.tool}
          onClick={() => onZoomChange(zoom * 0.9)}
          title="Zoom Out"
        >
          <i className="fas fa-search-minus" />
        </button>
        <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
        <button
          className={styles.tool}
          onClick={() => onZoomChange(zoom * 1.1)}
          title="Zoom In"
        >
          <i className="fas fa-search-plus" />
        </button>
      </div>

      <div className={styles.toolGroup}>
        <button
          className={styles.tool}
          onClick={onExport}
          title="Export Map"
        >
          <i className="fas fa-download" />
        </button>
      </div>
    </div>
  );
}; 