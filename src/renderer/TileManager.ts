import { Tile, TileLayerItem, LayerType } from '../types/map';

// Import all PNG files from the mapres and entities directories
// @ts-ignore - Vite's import.meta.glob typing
const entityTilesets: Record<string, string> = import.meta.glob('/public/entities/*.png', { eager: true, as: 'url' });
// @ts-ignore - Vite's import.meta.glob typing
const mapTilesets: Record<string, string> = import.meta.glob('/public/mapres/*.png', { eager: true, as: 'url' });

// Helper to get clean name from path
function getNameFromPath(path: string): string {
  return path.split('/').pop()?.replace('.png', '') || '';
}

// Process all tilesets and create the image paths and options
const IMAGE_PATHS: { [key: string]: string } = {};
export const GAME_LAYER_OPTIONS: { id: string, name: string }[] = [];
export const MAP_LAYER_OPTIONS: { id: string, name: string }[] = [];

// Process entity tilesets (game layers)
Object.entries(entityTilesets).forEach(([path, url]) => {
  const name = getNameFromPath(path);
  IMAGE_PATHS[name] = url.replace('/public/', '');
  GAME_LAYER_OPTIONS.push({ id: name, name });
});

// Process map tilesets
Object.entries(mapTilesets).forEach(([path, url]) => {
  const name = getNameFromPath(path);
  IMAGE_PATHS[name] = url.replace('/public/', '');
  MAP_LAYER_OPTIONS.push({ id: name, name });
});

// Sort options by name
GAME_LAYER_OPTIONS.sort((a, b) => {
  return a.name.localeCompare(b.name);
});

MAP_LAYER_OPTIONS.sort((a, b) => a.name.localeCompare(b.name));

// Helper function to get options based on layer type
export function getImageOptions(layerType: LayerType) {
  return layerType === LayerType.GAME ? GAME_LAYER_OPTIONS : MAP_LAYER_OPTIONS;
}

export class TileManager {
  public readonly tileSize: number = 64;
  private tilesetImages: { [key: string]: HTMLImageElement } = {};
  private tilesPerRow: number = 16;
  private isLoading: { [key: string]: boolean } = {};
  private loadPromises: { [key: string]: Promise<HTMLImageElement> } = {};

  constructor() {
    // Pre-load all tilesets
    Object.keys(IMAGE_PATHS).forEach(name => {
      this.loadTilemap(name, IMAGE_PATHS[name]);
    });
  }

  private loadTilemap(imageName: string, path: string): Promise<HTMLImageElement> {
    // Return existing promise if already loading
    if (this.loadPromises[imageName]) {
      return this.loadPromises[imageName];
    }

    // Return cached image if already loaded
    if (this.tilesetImages[imageName] && !this.isLoading[imageName]) {
      return Promise.resolve(this.tilesetImages[imageName]);
    }

    this.isLoading[imageName] = true;
    
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.isLoading[imageName] = false;
        this.tilesetImages[imageName] = img;
        delete this.loadPromises[imageName];
        resolve(img);
      };
      
      img.onerror = (e) => {
        console.error(`Failed to load tilemap ${path}:`, e);
        this.isLoading[imageName] = false;
        delete this.loadPromises[imageName];
        this.loadDefaultTileset(imageName).then(resolve, reject);
      };
      
      img.src = path;
    });

    this.loadPromises[imageName] = promise;
    return promise;
  }

  private loadDefaultTileset(imageName: string): Promise<HTMLImageElement> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      for (let y = 0; y < this.tilesPerRow; y++) {
        for (let x = 0; x < this.tilesPerRow; x++) {
          const tileX = x * this.tileSize;
          const tileY = y * this.tileSize;
          
          const hue = ((x + y * this.tilesPerRow) * 20) % 360;
          ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
          ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.strokeRect(tileX, tileY, this.tileSize, this.tileSize);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '20px Arial';
          ctx.fillText(`${x + y * this.tilesPerRow}`, tileX + 5, tileY + 25);
        }
      }

      const img = new Image();
      img.onload = () => {
        this.tilesetImages[imageName] = img;
        this.isLoading[imageName] = false;
        resolve(img);
      };
      img.src = canvas.toDataURL();
    });
  }

  public async getTileset(imageName: string): Promise<HTMLImageElement | null> {
    try {
      if (!(imageName in IMAGE_PATHS)) {
        console.warn(`Invalid image name: ${imageName}`);
        return null;
      }
      return await this.loadTilemap(imageName, IMAGE_PATHS[imageName]);
    } catch (e) {
      console.error('Error loading tileset:', e);
      return null;
    }
  }

  public createEmptyTileLayer(width: number, height: number): TileLayerItem {
    const tileData: Tile[] = new Array(width * height).fill(null).map(() => ({
      id: 0,
      flags: 0,
      skip: 0,
      reserved: 0
    }));

    return {
      type: LayerType.TILES,
      name: '',
      flags: 0,
      version: 1,
      width,
      height,
      color: { r: 255, g: 255, b: 255, a: 255 },
      colorEnv: -1,
      colorEnvOffset: 0,
      image: 'grass_main',
      data: 0,
      tileData
    };
  }

  public renderTile(
    ctx: CanvasRenderingContext2D, 
    tile: Tile, 
    x: number, 
    y: number,
    layer: TileLayerItem,
    givenTileSize: number = this.tileSize
  ) {
    if (tile.id === 0) return;

    const tilesetImage = this.tilesetImages[layer.image];
    if (!tilesetImage || this.isLoading[layer.image]) return;

    // For game layer, adjust tile coordinates based on game tile layout
    let tileX, tileY;
    if (layer.type === LayerType.GAME) {
      // Game layer tile layout
      const gameLayerTilesPerRow = 16;
      tileX = (tile.id % gameLayerTilesPerRow) * this.tileSize;
      tileY = Math.floor(tile.id / gameLayerTilesPerRow) * this.tileSize;
    } else {
      // Regular layer tile layout
      tileX = (tile.id % this.tilesPerRow) * this.tileSize;
      tileY = Math.floor(tile.id / this.tilesPerRow) * this.tileSize;
    }

    try {
      ctx.save();
      const centerX = x + givenTileSize / 2;
      const centerY = y + givenTileSize / 2;
      
      ctx.translate(centerX, centerY);
      
      const rotation = (tile.flags & 3) * 90;
      if (rotation) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      
      const flipH = tile.flags & 4 ? -1 : 1;
      const flipV = tile.flags & 8 ? -1 : 1;
      if (flipH === -1 || flipV === -1) {
        ctx.scale(flipH, flipV);
      }
      
      ctx.drawImage(
        tilesetImage,
        tileX, tileY,
        this.tileSize, this.tileSize,
        -givenTileSize / 2, -givenTileSize / 2,
        givenTileSize, givenTileSize
      );
    } catch (e) {
      console.error('Error rendering tile:', e);
    } finally {
      ctx.restore();
    }
  }

  public getTileAtPosition(x: number, y: number, layer: TileLayerItem): Tile | null {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    
    if (tileX < 0 || tileX >= layer.width || tileY < 0 || tileY >= layer.height) {
      return null;
    }

    return layer.tileData?.[tileY * layer.width + tileX] || null;
  }

  public setTile(
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