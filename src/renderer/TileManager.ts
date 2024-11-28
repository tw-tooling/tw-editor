import { Tile, TileLayerItem } from '../types/map';

export class TileManager {
  public readonly tileSize: number;
  private tilesetImage: HTMLImageElement | null = null;
  private tilesPerRow: number = 16;

  constructor(tileSize: number = 32) {
    this.tileSize = tileSize;
    this.loadDefaultTileset();
  }

  private loadDefaultTileset() {
    // Create a simple default tileset with colored squares
    const canvas = document.createElement('canvas');
    canvas.width = this.tileSize * this.tilesPerRow;
    canvas.height = this.tileSize * this.tilesPerRow;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate some basic tiles
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ffeb3b', '#9c27b0'];
    for (let i = 0; i < colors.length; i++) {
      const x = (i % this.tilesPerRow) * this.tileSize;
      const y = Math.floor(i / this.tilesPerRow) * this.tileSize;
      
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, this.tileSize, this.tileSize);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x, y, this.tileSize, this.tileSize);
    }

    this.tilesetImage = new Image();
    this.tilesetImage.src = canvas.toDataURL();
  }

  public createEmptyTileLayer(width: number, height: number): TileLayerItem {
    const tileData: Tile[] = new Array(width * height).fill(null).map(() => ({
      id: 0,
      flags: 0,
      skip: 0,
      reserved: 0
    }));

    return {
      type: 2, // LayerType.TILES
      flags: 0,
      version: 1,
      width,
      height,
      color: { r: 255, g: 255, b: 255, a: 255 },
      colorEnv: -1,
      colorEnvOffset: 0,
      image: -1,
      data: 0,
      tileData
    };
  }

  public renderTile(
    ctx: CanvasRenderingContext2D, 
    tile: Tile, 
    x: number, 
    y: number
  ) {
    if (!this.tilesetImage || tile.id === 0) return;

    const tileX = (tile.id % this.tilesPerRow) * this.tileSize;
    const tileY = Math.floor(tile.id / this.tilesPerRow) * this.tileSize;

    ctx.drawImage(
      this.tilesetImage,
      tileX, tileY,
      this.tileSize, this.tileSize,
      x, y,
      this.tileSize, this.tileSize
    );
  }

  public getTileAtPosition(x: number, y: number, layer: TileLayerItem): Tile | null {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    
    if (tileX < 0 || tileX >= layer.width || tileY < 0 || tileY >= layer.height) {
      return null;
    }

    return layer.tileData?.[tileY * layer.width + tileX] || null;
  }

  public setTileAtPosition(
    tileX: number, 
    tileY: number, 
    layer: TileLayerItem, 
    tileId: number
  ): boolean {
    if (tileX < 0 || tileX >= layer.width || tileY < 0 || tileY >= layer.height) {
      return false;
    }

    if (layer.tileData) {
      const index = tileY * layer.width + tileX;
      layer.tileData[index] = {
        id: tileId,
        flags: 0,
        skip: 0,
        reserved: 0
      };
      return true;
    }
    return false;
  }
} 