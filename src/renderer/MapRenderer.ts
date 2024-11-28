import { MapData, LayerType, TileLayerItem } from '../types/map';
import { TileManager } from './TileManager';

export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private mapData: MapData;
  private tileManager: TileManager;
  private selectedTileId: number = 1;
  private currentZoom: number = 1;
  private currentOffsetX: number = 0;
  private currentOffsetY: number = 0;

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
    // Store current transform state
    this.currentZoom = zoom;
    this.currentOffsetX = offsetX;
    this.currentOffsetY = offsetY;

    this.ctx.save();
    
    // Clear the entire canvas first
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    
    // Apply transformations in the correct order:
    // 1. Scale (zoom)
    // 2. Translate (pan)
    this.ctx.setTransform(
      zoom, 0,
      0, zoom,
      offsetX,
      offsetY
    );

    // Render grid
    this.renderGrid();

    // Debug: Draw a reference rectangle at map origin
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
    x: number,  // clientX from mouse event
    y: number,  // clientY from mouse event
    selectedLayer: TileLayerItem,
    onLayerUpdate?: (updatedLayer: TileLayerItem) => void,
    forceTileId?: number
  ) {
    if (!selectedLayer) {
      console.warn('No layer selected');
      return;
    }

    // Step 1: Browser coordinates to Canvas coordinates
    const rect = this.ctx.canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    // Step 2: Canvas coordinates to Map coordinates using stored transform
    const mapX = (canvasX - this.currentOffsetX) / this.currentZoom;
    const mapY = (canvasY - this.currentOffsetY) / this.currentZoom;

    // Step 3: Map coordinates to Tile coordinates
    const tileX = Math.floor(mapX / this.tileManager.tileSize);
    const tileY = Math.floor(mapY / this.tileManager.tileSize);

    const success = this.tileManager.setTileAtPosition(
      tileX,
      tileY,
      selectedLayer,
      forceTileId !== undefined ? forceTileId : this.selectedTileId
    );

    if (success && onLayerUpdate) {
      onLayerUpdate({ ...selectedLayer });
    }
  }

  public setSelectedTile(id: number) {
    this.selectedTileId = id;
  }

  private renderGrid() {
    // Calculate visible area in world coordinates
    const transform = this.ctx.getTransform();
    const canvasWidth = this.ctx.canvas.width;
    const canvasHeight = this.ctx.canvas.height;

    // Convert canvas bounds to world coordinates
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);

    // Add padding to ensure grid covers edges when rotated
    const padding = this.tileManager.tileSize * 2;
    const startX = Math.floor(topLeft.x / this.tileManager.tileSize) * this.tileManager.tileSize - padding;
    const startY = Math.floor(topLeft.y / this.tileManager.tileSize) * this.tileManager.tileSize - padding;
    const endX = Math.ceil(bottomRight.x / this.tileManager.tileSize) * this.tileManager.tileSize + padding;
    const endY = Math.ceil(bottomRight.y / this.tileManager.tileSize) * this.tileManager.tileSize + padding;

    // Draw grid
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1 / transform.a;  // Scale line width with zoom

    // Vertical lines
    for (let x = startX; x <= endX; x += this.tileManager.tileSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += this.tileManager.tileSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }

    this.ctx.stroke();
  }

  private screenToWorld(screenX: number, screenY: number) {
    const transform = this.ctx.getTransform();
    return {
      x: (screenX - transform.e) / transform.a,
      y: (screenY - transform.f) / transform.d
    };
  }

  private renderTileLayer(layer: TileLayerItem) {
    if (!layer.tileData) {
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