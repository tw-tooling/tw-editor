// Map file format types based on documentation

export enum ItemType {
  VERSION = 0,
  INFO = 1,
  IMAGE = 2, 
  ENVELOPE = 3,
  GROUP = 4,
  LAYER = 5,
  ENVPOINT = 6
}

// Version info
export interface VersionItem {
  version: number;
}

// Map info
export interface InfoItem {
  author: string;
  version: string;
  credits: string;
  license: string;
  settings: string[];
}

// Image item
export interface ImageItem {
  width: number;
  height: number;
  external: boolean;
  name: string;
  data: number;  // Index to image data
  version?: number;  // Added for export
}

// Group item
export interface GroupItem {
  offsetX: number;
  offsetY: number;
  parallaxX: number;
  parallaxY: number;
  startLayer: number;
  numLayers: number;
  useClipping: number;
  clipX: number;
  clipY: number;
  clipW: number;
  clipH: number;
  name: string;
}

// Layer types
export enum LayerType {
  INVALID = 0,
  GAME = 1,
  TILES = 2,
  QUADS = 3,
  FRONT = 4,
  TELE = 5,
  SPEEDUP = 6,
  SWITCH = 7,
  TUNE = 8,
  SOUNDS = 9
}

// Base layer interface
export interface LayerItem {
  type: LayerType;
  flags: number;
}

// Tile data structure
export interface Tile {
  id: number;      // Tile index
  flags: number;   // Rotation and flip flags
  skip: number;    // Number of empty tiles to skip
  reserved: number;
}

// Tile layer
export interface TileLayerItem extends LayerItem {
  version: number;
  width: number;
  height: number;
  flags: number;
  color: { r: number; g: number; b: number; a: number };
  colorEnv: number;
  colorEnvOffset: number;
  image: number;
  data: number;  // Index to tile data
  tileData?: Tile[];  // Parsed tile data
  name: string;
}

// Quad struct for quad layers
export interface Quad {
  points: Array<{x: number; y: number}>;
  colors: Array<{r: number; g: number; b: number; a: number}>;
  texCoords: Array<{x: number; y: number}>;
  posEnv: number;
  posEnvOffset: number;
  colorEnv: number;
  colorEnvOffset: number;
}

// Quad layer
export interface QuadLayerItem extends LayerItem {
  version: number;
  numQuads: number;
  data: number;  // Index to quad data
  image: number;
}

// Map file header structure
export interface MapHeader {
  signature: Uint8Array; // 'DATA' magic bytes
  version: number;       // Version 3 or 4
  size: number;         
  swapLen: number;
  numItemTypes: number;
  numItems: number;
  numData: number;
  itemSize: number;
  dataSize: number;
}

// Item type info
export interface ItemTypeInfo {
  typeId: number;
  start: number; 
  num: number;
}

// Basic item structure
export interface MapItem {
  size: number;
  data: ArrayBuffer;
  parsed?: TileLayerItem | VersionItem | InfoItem | ImageItem | GroupItem;
}

// Map data container
export interface MapData {
  header: MapHeader;
  itemTypes: ItemTypeInfo[];
  itemOffsets: number[];
  dataOffsets: number[];
  dataSizes?: number[]; // Only in version 4
  items: MapItem[];
  data: ArrayBuffer[];
} 