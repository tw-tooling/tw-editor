import { MapData, TileLayerItem, Tile, LayerType } from '../types/map';
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
  }

  public updateMapData(mapData: MapData) {
    this.mapData = mapData;
  }

  public setSelectedTileId(id: number) {
    this.selectedTileId = id;
  }

  private renderGrid() {
    const ctx = this.ctx;
    const tileSize = this.tileManager.tileSize;
    
    // Calculate visible area in world coordinates
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Convert canvas bounds to world coordinates
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);
    
    // Add padding to ensure grid covers edges when rotated
    const padding = tileSize * 2;
    const startX = Math.floor(topLeft.x / tileSize) * tileSize - padding;
    const startY = Math.floor(topLeft.y / tileSize) * tileSize - padding;
    const endX = Math.ceil(bottomRight.x / tileSize) * tileSize + padding;
    const endY = Math.ceil(bottomRight.y / tileSize) * tileSize + padding;
    
    // Draw grid
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / this.currentZoom; // Scale line width with zoom
    
    // Vertical lines
    for (let x = startX; x <= endX; x += tileSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += tileSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    
    ctx.stroke();
  }

  private screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX - this.currentOffsetX) / this.currentZoom,
      y: (screenY - this.currentOffsetY) / this.currentZoom
    };
  }

  private renderMapOutline() {
    // Find the first tile layer to get map dimensions
    const tileLayer = this.mapData.items.find(item => 
      item.parsed && 'type' in item.parsed && 
      (item.parsed.type === LayerType.TILES || item.parsed.type === LayerType.GAME)
    )?.parsed;

    if (!tileLayer || !('width' in tileLayer)) return;

    const width = tileLayer.width * this.tileManager.tileSize;
    const height = tileLayer.height * this.tileManager.tileSize;

    // Draw outline
    this.ctx.strokeStyle = 'rgba(0, 162, 255, 0.5)';
    this.ctx.lineWidth = 2 / this.currentZoom;
    this.ctx.strokeRect(0, 0, width, height);

    // Draw a subtle fill to make the map area visible
    this.ctx.fillStyle = 'rgba(0, 162, 255, 0.03)';
    this.ctx.fillRect(0, 0, width, height);
  }

  public render(zoom: number, offsetX: number, offsetY: number) {
    this.currentZoom = zoom;
    this.currentOffsetX = offsetX;
    this.currentOffsetY = offsetY;

    // Clear the canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    // Apply transformations
    this.ctx.setTransform(
      zoom, 0,
      0, zoom,
      offsetX,
      offsetY
    );

    // Draw grid first
    this.renderGrid();

    // Draw map outline
    this.renderMapOutline();

    // Render each layer
    this.mapData.items.forEach(item => {
      if (item.parsed && 'type' in item.parsed && 
          (item.parsed.type === LayerType.TILES || item.parsed.type === LayerType.GAME)) {
        const layer = item.parsed;
        if (!layer.tileData) return;

        let tileIndex = 0;
        for (let y = 0; y < layer.height; y++) {
          for (let x = 0; x < layer.width; x++) {
            const tile = layer.tileData[tileIndex++];
            if (tile && tile.id !== 0) {
              this.tileManager.renderTile(
                this.ctx,
                tile,
                x * this.tileManager.tileSize,
                y * this.tileManager.tileSize,
                layer,
                this.tileManager.tileSize
              );
            }
          }
        }
      }
    });
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

    // Convert screen coordinates to world coordinates
    const rect = this.ctx.canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    const worldX = (canvasX - this.currentOffsetX) / this.currentZoom;
    const worldY = (canvasY - this.currentOffsetY) / this.currentZoom;

    // Convert world coordinates to tile coordinates
    const tileX = Math.floor(worldX / this.tileManager.tileSize);
    const tileY = Math.floor(worldY / this.tileManager.tileSize);

    const success = this.tileManager.setTile(
      tileX,
      tileY,
      selectedLayer,
      forceTileId !== undefined ? forceTileId : this.selectedTileId
    );

    if (success && onLayerUpdate) {
      onLayerUpdate({ ...selectedLayer });
    }
  }

  public renderPreviewTile(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    x: number,
    y: number,
    layer: TileLayerItem,
    tileSize: number
  ) {
    if (tile.id !== 0) {
      this.tileManager.renderTile(ctx, tile, x, y, layer, tileSize);
    }
  }
} 