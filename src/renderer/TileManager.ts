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
const IMAGE_PATHS: { [key: number]: string } = {};
export const GAME_LAYER_OPTIONS: { id: number, name: string }[] = [];
export const MAP_LAYER_OPTIONS: { id: number, name: string }[] = [];

// Create maps of names to IDs for consistent ID assignment
const GAME_NAME_TO_ID = new Map<string, number>();
const MAP_NAME_TO_ID = new Map<string, number>();

// First, collect all unique names and assign IDs
// Process entity tilesets (game layers)
Object.keys(entityTilesets).forEach(path => {
  const name = getNameFromPath(path);
  if (!GAME_NAME_TO_ID.has(name)) {
    // Vanilla gets -1, others get sequential negative IDs
    const id = name.toLowerCase() === 'vanilla' ? -1 : -(GAME_NAME_TO_ID.size + 2);
    GAME_NAME_TO_ID.set(name, id);
  }
});

// Process map tilesets (regular layers)
Object.keys(mapTilesets).forEach(path => {
  const name = getNameFromPath(path);
  if (!MAP_NAME_TO_ID.has(name)) {
    MAP_NAME_TO_ID.set(name, MAP_NAME_TO_ID.size);
  }
});

// Then process entities
Object.entries(entityTilesets).forEach(([path, url]) => {
  const name = getNameFromPath(path);
  const id = GAME_NAME_TO_ID.get(name)!;
  IMAGE_PATHS[id] = url;
  GAME_LAYER_OPTIONS.push({ id, name });
});

// Then process map tilesets
Object.entries(mapTilesets).forEach(([path, url]) => {
  const name = getNameFromPath(path);
  const id = MAP_NAME_TO_ID.get(name)!;
  IMAGE_PATHS[id] = url;
  MAP_LAYER_OPTIONS.push({ id, name });
});

// Sort options by name
GAME_LAYER_OPTIONS.sort((a, b) => {
  // Keep vanilla (id: -1) at the top
  if (a.id === -1) return -1;
  if (b.id === -1) return 1;
  return a.name.localeCompare(b.name);
});

MAP_LAYER_OPTIONS.sort((a, b) => a.name.localeCompare(b.name));

// Helper function to get options based on layer type
export function getImageOptions(layerType: LayerType) {
  return layerType === LayerType.GAME ? GAME_LAYER_OPTIONS : MAP_LAYER_OPTIONS;
}

export class TileManager {
  public readonly tileSize: number = 64;
  private tilesetImages: { [key: number]: HTMLImageElement } = {};
  private tilesPerRow: number = 16;
  private isLoading: { [key: number]: boolean } = {};
  private loadPromises: { [key: number]: Promise<HTMLImageElement> } = {};

  constructor() {
    // Pre-load all tilesets
    Object.entries(IMAGE_PATHS).forEach(([id, path]) => {
      this.loadTilemap(parseInt(id), path);
    });
  }

  private loadTilemap(id: number, path: string): Promise<HTMLImageElement> {
    // Return existing promise if already loading
    if (this.loadPromises[id]) {
      return this.loadPromises[id];
    }

    // Return cached image if already loaded
    if (this.tilesetImages[id] && !this.isLoading[id]) {
      return Promise.resolve(this.tilesetImages[id]);
    }

    this.isLoading[id] = true;
    
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.isLoading[id] = false;
        this.tilesetImages[id] = img;
        delete this.loadPromises[id];
        resolve(img);
      };
      
      img.onerror = (e) => {
        console.error(`Failed to load tilemap ${path}:`, e);
        this.isLoading[id] = false;
        delete this.loadPromises[id];
        this.loadDefaultTileset(id).then(resolve, reject);
      };
      
      img.src = path;
    });

    this.loadPromises[id] = promise;
    return promise;
  }

  private loadDefaultTileset(id: number): Promise<HTMLImageElement> {
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
        this.tilesetImages[id] = img;
        this.isLoading[id] = false;
        resolve(img);
      };
      img.src = canvas.toDataURL();
    });
  }

  public async getTileset(id: number): Promise<HTMLImageElement | null> {
    try {
      if (!(id in IMAGE_PATHS)) {
        console.warn(`Invalid image ID: ${id}`);
        return null;
      }
      return await this.loadTilemap(id, IMAGE_PATHS[id]);
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
      type: 2,
      name: '',
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
    y: number,
    layer: TileLayerItem,
    givenTileSize: number = this.tileSize
  ) {
    if (tile.id === 0) return;

    const imageId = layer.image;
    // For game layer, use vanilla tileset
    const effectiveImageId = layer.type === LayerType.GAME ? -1 : imageId;
    
    // Check if the image ID exists in our paths
    if (!(effectiveImageId in IMAGE_PATHS)) {
      console.warn(`Invalid image ID: ${effectiveImageId}`);
      return;
    }

    const tilesetImage = this.tilesetImages[effectiveImageId];
    if (!tilesetImage || this.isLoading[effectiveImageId]) return;

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