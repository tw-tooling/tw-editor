import React from 'react';
import { MinimalMapExporter } from '../map/MinimalMapExporter';

export const MinimalMapTest: React.FC = () => {
  const handleExport = () => {
    const buffer = MinimalMapExporter.exportMinimalMap();
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minimal.map';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Minimal Map Test</h1>
      <button onClick={handleExport}>Export Minimal Map</button>
    </div>
  );
}; 