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
  }

  public updateMapData(mapData: MapData) {
    this.mapData = mapData;
  }

  public setSelectedTileId(id: number) {
    this.selectedTileId = id;
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

    // Render each layer
    this.mapData.items.forEach(item => {
      if (item.parsed && 'type' in item.parsed && item.parsed.type === 2) { // TileLayer
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
} 