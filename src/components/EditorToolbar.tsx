import React from 'react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  tool: 'select' | 'brush' | 'fill';
  onToolChange: (tool: 'select' | 'brush' | 'fill') => void;
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
          title="Select Tool (V)"
        >
          <i className="fas fa-mouse-pointer" />
        </button>
        <button
          className={`${styles.tool} ${tool === 'brush' ? styles.active : ''}`}
          onClick={() => onToolChange('brush')}
          title="Brush Tool (B)"
        >
          <i className="fas fa-paint-brush" />
        </button>
        <button
          className={`${styles.tool} ${tool === 'fill' ? styles.active : ''}`}
          onClick={() => onToolChange('fill')}
          title="Fill Tool (F)"
        >
          <i className="fas fa-fill-drip" />
        </button>
      </div>

      <div className={styles.zoomControls}>
        <button
          onClick={() => onZoomChange(zoom / 1.5)}
          disabled={zoom <= 0.1}
        >
          <i className="fas fa-minus" />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => onZoomChange(zoom * 1.5)}
          disabled={zoom >= 10}
        >
          <i className="fas fa-plus" />
        </button>
      </div>
    </div>
  );
}; 