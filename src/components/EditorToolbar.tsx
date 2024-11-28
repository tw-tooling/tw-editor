import React from 'react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  tool: 'select' | 'brush' | 'fill' | 'eraser';
  onToolChange: (tool: 'select' | 'brush' | 'fill' | 'eraser') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  tool,
  onToolChange,
  zoom,
  onZoomChange
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
          title="Brush Tool"
        >
          <i className="fas fa-paint-brush" />
        </button>
        <button
          className={`${styles.tool} ${tool === 'fill' ? styles.active : ''}`}
          onClick={() => onToolChange('fill')}
          title="Fill Tool"
        >
          <i className="fas fa-fill-drip" />
        </button>
        <button
          className={`${styles.tool} ${tool === 'eraser' ? styles.active : ''}`}
          onClick={() => onToolChange('eraser')}
          title="Eraser Tool"
        >
          <i className="fas fa-eraser" />
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
    </div>
  );
}; 