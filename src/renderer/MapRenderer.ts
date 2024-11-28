import { MapData, LayerType, TileLayerItem } from '../types/map';
import { TileManager } from './TileManager';

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private mapData: MapData;
  private tileManager: TileManager;
  private selectedTileId: number = 1;

  constructor(ctx: CanvasRenderingContext2D, mapData: MapData) {
    this.ctx = ctx;
    this.mapData = mapData;
    this.tileManager = new TileManager();

    // Ensure tileset is loaded before first render
    requestAnimationFrame(() => {
      this.render(1, 0, 0);
    });
  }

  public updateMapData(mapData: MapData) {
    this.mapData = mapData;
  }

  public render(zoom: number, offsetX: number = 0, offsetY: number = 0) {
    this.ctx.save();
    
    // Clear the entire canvas first
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    
    // Apply transformations
    this.ctx.setTransform(
      zoom, 0,
      0, zoom,
      offsetX,
      offsetY
    );

    // Render grid
    this.renderGrid();

    // Debug: Draw a reference rectangle
    this.ctx.strokeStyle = 'red';
    this.ctx.strokeRect(0, 0, 100, 100);

    // Render layers in order
    this.mapData.items.forEach((layer, index) => {
      if (layer.parsed && 'type' in layer.parsed && layer.parsed.type === LayerType.TILES) {
        this.renderTileLayer(layer.parsed as TileLayerItem);
      }
    });

    this.ctx.restore();
  }

  public handleMouseDown(
    x: number, 
    y: number, 
    selectedLayer: TileLayerItem,
    onLayerUpdate?: (updatedLayer: TileLayerItem) => void,
    forceTileId?: number
  ) {
    if (!selectedLayer) {
      console.warn('No layer selected');
      return;
    }

    // Get the canvas rect to handle offset
    const rect = this.ctx.canvas.getBoundingClientRect();
    
    // Convert screen coordinates to canvas coordinates
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    // Convert to world coordinates
    const transform = this.ctx.getTransform();
    const worldX = (canvasX - transform.e) / transform.a;
    const worldY = (canvasY - transform.f) / transform.d;

    const success = this.tileManager.setTileAtPosition(
      worldX,
      worldY,
      selectedLayer,
      forceTileId !== undefined ? forceTileId : this.selectedTileId
    );

    if (success && onLayerUpdate) {
      onLayerUpdate({ ...selectedLayer });
      this.render(transform.a, transform.e, transform.f);
    }
  }

  public setSelectedTile(id: number) {
    this.selectedTileId = id;
  }

  private renderGrid() {
    const width = this.ctx.canvas.width / this.ctx.getTransform().a;
    const height = this.ctx.canvas.height / this.ctx.getTransform().d;

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1 / this.ctx.getTransform().a;

    for (let x = 0; x < width; x += this.tileManager.tileSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
    }

    for (let y = 0; y < height; y += this.tileManager.tileSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }

    this.ctx.stroke();
  }

  private renderTileLayer(layer: TileLayerItem) {
    if (!layer.tileData) {
      console.log('Creating empty layer:', layer.width, layer.height);
      layer.tileData = this.tileManager.createEmptyTileLayer(
        layer.width, 
        layer.height
      ).tileData;
    }

    // Debug: Draw layer bounds
    this.ctx.strokeStyle = 'blue';
    this.ctx.strokeRect(
      0, 0,
      layer.width * this.tileManager.tileSize,
      layer.height * this.tileManager.tileSize
    );

    // Render tiles
    let tileIndex = 0;
    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const tile = layer.tileData[tileIndex++];
        if (tile && tile.id !== 0) {
          this.tileManager.renderTile(
            this.ctx,
            tile,
            x * this.tileManager.tileSize,
            y * this.tileManager.tileSize
          );
        }
      }
    }
  }
} 