import React, { useState, useEffect } from 'react';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  tool: 'select' | 'brush';
  mode: 'primary' | 'secondary';
  onToolChange: (tool: 'select' | 'brush', mode: 'primary' | 'secondary') => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onExport: () => void;
}

type ToolMode = 'primary' | 'secondary';

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  tool,
  mode,
  onToolChange,
  zoom,
  onZoomChange,
  onExport
}) => {
  const [selectMode, setSelectMode] = useState<ToolMode>('primary');
  const [brushMode, setBrushMode] = useState<ToolMode>('primary');

  // Update local mode states when parent mode changes
  useEffect(() => {
    if (tool === 'select') {
      setSelectMode(mode);
    } else {
      setBrushMode(mode);
    }
  }, [tool, mode]);

  const handleToolClick = (toolType: 'select' | 'brush', event: React.MouseEvent | React.TouchEvent) => {
    // For mouse clicks, just change the tool with primary mode
    if ('button' in event) {
      onToolChange(toolType, 'primary');
      return;
    }

    // For touch events, toggle mode if the current tool is already selected
    if (toolType === 'select') {
      if (tool === 'select') {
        const newMode = selectMode === 'primary' ? 'secondary' : 'primary';
        setSelectMode(newMode);
        onToolChange('select', newMode);
      } else {
        setSelectMode('primary');
        onToolChange('select', 'primary');
      }
    } else if (toolType === 'brush') {
      if (tool === 'brush') {
        const newMode = brushMode === 'primary' ? 'secondary' : 'primary';
        setBrushMode(newMode);
        onToolChange('brush', newMode);
      } else {
        setBrushMode('primary');
        onToolChange('brush', 'primary');
      }
    }
  };

  const getToolIcon = (toolType: 'select' | 'brush') => {
    if (toolType === 'select') {
      return selectMode === 'primary' ? 'fa-mouse-pointer' : 'fa-paste';
    } else {
      return brushMode === 'primary' ? 'fa-paint-brush' : 'fa-eraser';
    }
  };

  const getToolTitle = (toolType: 'select' | 'brush') => {
    if (toolType === 'select') {
      return selectMode === 'primary' ? 'Select Tool' : 'Insert Tool';
    } else {
      return brushMode === 'primary' ? 'Draw Tool' : 'Erase Tool';
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          className={`${styles.tool} ${tool === 'select' ? styles.active : ''}`}
          onClick={(e) => handleToolClick('select', e)}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleToolClick('select', e);
          }}
          title={getToolTitle('select')}
        >
          <i className={`fas ${getToolIcon('select')}`} />
        </button>
        <button
          className={`${styles.tool} ${tool === 'brush' ? styles.active : ''}`}
          onClick={(e) => handleToolClick('brush', e)}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleToolClick('brush', e);
          }}
          title={getToolTitle('brush')}
        >
          <i className={`fas ${getToolIcon('brush')}`} />
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