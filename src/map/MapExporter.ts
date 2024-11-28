import { ItemType, LayerType, MapData, ImageItem } from '../types/map';
import pako from 'pako';

interface SimpleItem {
  typeAndId: number;
  data: number[];
}

export class MapExporter {
  private static HEADER_SIZE = 36;
  private static ITEMTYPE_SIZE = 12;
  private static ITEM_SIZE = 8;

  private static TILE = {
    AIR: 0,
    SOLID: 1,
    DEATH: 2,
    NOHOOK: 3,
    SPAWN: 192,
    SPAWN_RED: 193,
    SPAWN_BLUE: 194,
    FLAGSTAND_RED: 195,
    FLAGSTAND_BLUE: 196,
  };

  public static exportMap(mapData: MapData): ArrayBuffer {
    const mapWidth = 100;
    const mapHeight = 50;

    // Get image items and their names
    const imageItems = mapData.items
      .filter(item => (item.typeAndId >> 16) === ItemType.IMAGE)
      .sort((a, b) => (a.typeAndId & 0xFFFF) - (b.typeAndId & 0xFFFF));

    // Create image name byte arrays
    const imageData = imageItems.map(item => {
      if (!item.parsed || !('name' in item.parsed)) return new Uint8Array(0);
      const encoder = new TextEncoder();
      return encoder.encode(item.parsed.name + '\0');
    });

    // Create game layer data (with walls and spawns)
    const gameLayerData = new Uint8Array(mapWidth * mapHeight * 4);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const i = (y * mapWidth + x) * 4;
        
        // Create ground
        if (y >= mapHeight - 5) {
          gameLayerData[i] = this.TILE.SOLID;
        }
        // Create side walls
        else if (x < 3 || x >= mapWidth - 3) {
          gameLayerData[i] = this.TILE.SOLID;
        }
        // Create platforms
        else if (y === mapHeight - 15 && (x < mapWidth/3 || x > mapWidth*2/3)) {
          gameLayerData[i] = this.TILE.SOLID;
        }
        // Create spawn points
        else if (y === mapHeight - 6) {
          if (x === 10) gameLayerData[i] = this.TILE.SPAWN_RED;
          if (x === mapWidth - 10) gameLayerData[i] = this.TILE.SPAWN_BLUE;
        }
        // Create flag stands
        else if (y === mapHeight - 6) {
          if (x === 20) gameLayerData[i] = this.TILE.FLAGSTAND_RED;
          if (x === mapWidth - 20) gameLayerData[i] = this.TILE.FLAGSTAND_BLUE;
        }
      }
    }

    // Create front layer data (decoration)
    const frontLayerData = new Uint8Array(mapWidth * mapHeight * 4);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const i = (y * mapWidth + x) * 4;
        // Add some decorative tiles
        if (y === mapHeight - 15 && (x < mapWidth/3 || x > mapWidth*2/3)) {
          frontLayerData[i] = 1;
        }
      }
    }

    // Create unhookable layer data
    const unhookableLayerData = new Uint8Array(mapWidth * mapHeight * 4);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const i = (y * mapWidth + x) * 4;
        // Add some unhookable areas
        if (y < mapHeight - 15 && y > mapHeight - 25 && x > mapWidth/2 - 5 && x < mapWidth/2 + 5) {
          unhookableLayerData[i] = 1;
        }
      }
    }

    // Create background layer data
    const backgroundLayerData = new Uint8Array(mapWidth * mapHeight * 4);
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const i = (y * mapWidth + x) * 4;
        // Add some background tiles
        if ((x + y) % 4 === 0) {
          backgroundLayerData[i] = 1;
        }
      }
    }

    // Create data array in same order as Python example
    const data = [
      ...imageData,  // Image names first
      gameLayerData,  // Then game layer
      frontLayerData,  // Then tile layers
      unhookableLayerData,
      backgroundLayerData
    ];

    // Compress all data
    const compressedData = data.map(d => pako.deflate(d));

    // Create minimal items array with data as integer arrays
    const items: SimpleItem[] = [
      // Version item
      {
        typeAndId: (ItemType.VERSION << 16) | 0,
        data: [1]  // version 1
      },
      // Info item
      {
        typeAndId: (ItemType.INFO << 16) | 0,
        data: [1, -1, -1, -1, -1, -1]  // version 1 + empty strings
      },
      // Image items
      ...imageItems.map((item, i) => ({
        typeAndId: item.typeAndId,
        data: [1, 1024, 1024, 1, i, -1]  // version, width, height, external, image_id, name
      })),
      // Group item
      {
        typeAndId: (ItemType.GROUP << 16) | 0,
        data: [3, 0, 0, 100, 100, 0, 4, 0, 0, 0, 0, 0, -1, -1, -1]  // 4 layers
      },
      // Game layer
      {
        typeAndId: (ItemType.LAYER << 16) | 0,
        data: [
          0, LayerType.TILES, 0,  // header
          3, mapWidth, mapHeight, 1,  // version, width, height, flags
          255, 255, 255, 255,  // color
          -1, 0, -1, imageData.length,  // color env, image (-1), data
          -1, -1, -1,  // name
          -1, -1, -1, -1, -1  // reserved
        ]
      },
      // Front layer (using grass tileset)
      {
        typeAndId: (ItemType.LAYER << 16) | 1,
        data: [
          0, LayerType.TILES, 0,  // header
          3, mapWidth, mapHeight, 0,  // version, width, height, flags
          255, 255, 255, 255,  // color
          -1, 0, 0, imageData.length + 1,  // color env, image (grass), data
          -1, -1, -1,  // name
          -1, -1, -1, -1, -1  // reserved
        ]
      },
      // Unhookable layer
      {
        typeAndId: (ItemType.LAYER << 16) | 2,
        data: [
          0, LayerType.TILES, 0,  // header
          3, mapWidth, mapHeight, 0,  // version, width, height, flags
          255, 255, 255, 255,  // color
          -1, 1, 1, imageData.length + 2,  // color env, image (unhookable), data
          -1, -1, -1,  // name
          -1, -1, -1, -1, -1  // reserved
        ]
      },
      // Background layer (using desert tileset)
      {
        typeAndId: (ItemType.LAYER << 16) | 3,
        data: [
          0, LayerType.TILES, 0,  // header
          3, mapWidth, mapHeight, 0,  // version, width, height, flags
          255, 255, 255, 255,  // color
          -1, 2, 2, imageData.length + 3,  // color env, image (desert), data
          -1, -1, -1,  // name
          -1, -1, -1, -1, -1  // reserved
        ]
      },
      // Envpoint item
      {
        typeAndId: (ItemType.ENVPOINT << 16) | 0,
        data: []
      }
    ];

    // Calculate item types
    const itemTypes = [
      { typeId: ItemType.VERSION, start: 0, num: 1 },
      { typeId: ItemType.INFO, start: 1, num: 1 },
      { typeId: ItemType.IMAGE, start: 2, num: imageItems.length },
      { typeId: ItemType.GROUP, start: 2 + imageItems.length, num: 1 },
      { typeId: ItemType.LAYER, start: 3 + imageItems.length, num: 4 },
      { typeId: ItemType.ENVPOINT, start: 3 + imageItems.length + 4, num: 1 }
    ];

    // Calculate offsets and sizes
    const itemOffsets: number[] = [];
    let currentOffset = 0;
    items.forEach(item => {
      itemOffsets.push(currentOffset);
      currentOffset += (item.data.length + 2) * 4;  // +2 for typeAndId and size
    });

    const itemAreaSize = currentOffset;
    const dataAreaSize = compressedData.reduce((sum, d) => sum + d.length, 0);

    // Calculate total size
    const itemTypesSize = itemTypes.length * this.ITEMTYPE_SIZE;
    const itemOffsetsSize = items.length * 4;
    const dataOffsetsSize = compressedData.length * 4;
    const dataSizesSize = compressedData.length * 4;
    const headerAndMetadataSize = this.HEADER_SIZE + itemTypesSize + itemOffsetsSize + dataOffsetsSize + dataSizesSize;
    const totalSize = headerAndMetadataSize + itemAreaSize + dataAreaSize;

    // Create buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write header
    const signature = new TextEncoder().encode('DATA');
    new Uint8Array(buffer, offset, 4).set(signature);
    offset += 4;

    view.setInt32(offset, 4, true); offset += 4; // version
    view.setInt32(offset, totalSize - 16, true); offset += 4; // size
    view.setInt32(offset, headerAndMetadataSize + itemAreaSize - 16, true); offset += 4; // swaplen
    view.setInt32(offset, itemTypes.length, true); offset += 4; // num_item_types
    view.setInt32(offset, items.length, true); offset += 4; // num_items
    view.setInt32(offset, compressedData.length, true); offset += 4; // num_data
    view.setInt32(offset, itemAreaSize, true); offset += 4; // item_size
    view.setInt32(offset, dataAreaSize, true); offset += 4; // data_size

    // Write item types
    itemTypes.forEach(type => {
      view.setInt32(offset, type.typeId, true); offset += 4;
      view.setInt32(offset, type.start, true); offset += 4;
      view.setInt32(offset, type.num, true); offset += 4;
    });

    // Write item offsets
    itemOffsets.forEach(itemOffset => {
      view.setInt32(offset, itemOffset, true);
      offset += 4;
    });

    // Write data offsets
    let dataOffset = 0;
    compressedData.forEach(data => {
      view.setInt32(offset, dataOffset, true);
      offset += 4;
      dataOffset += data.length;
    });

    // Write data sizes (uncompressed)
    data.forEach(d => {
      view.setInt32(offset, d.length, true);
      offset += 4;
    });

    // Write items
    items.forEach(item => {
      // Write type and size
      view.setInt32(offset, item.typeAndId, true);
      offset += 4;
      view.setInt32(offset, item.data.length * 4, true);
      offset += 4;

      // Write item data
      item.data.forEach(value => {
        view.setInt32(offset, value, true);
        offset += 4;
      });
    });

    // Write compressed data
    compressedData.forEach(data => {
      new Uint8Array(buffer, offset, data.length).set(data);
      offset += data.length;
    });

    return buffer;
  }

  public static downloadMap(mapData: MapData, filename: string = 'untitled.map'): void {
    const buffer = this.exportMap(mapData);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
