import { ItemType, LayerType, MapData, TileLayerItem } from '../types/map';
import pako from 'pako';

// Constants matching Python version
const ITEM_TYPES = {
  VERSION: 0,
  INFO: 1,
  IMAGE: 2,
  ENVELOPE: 3,
  GROUP: 4,
  LAYER: 5,
  ENVPOINT: 6
};

class Item {
  constructor(
    public id: number,
    public type: number,
    public data: number[]
  ) {}

  get length(): number {
    return (this.data.length + 2) * 4;
  }

  toByte(view: DataView, offset: number): number {
    view.setInt32(offset, (this.type << 16) + this.id, true);
    offset += 4;
    view.setInt32(offset, this.data.length * 4, true);
    offset += 4;
    this.data.forEach(value => {
      view.setInt32(offset, value, true);
      offset += 4;
    });
    return offset;
  }
}

export class MapExporter {
  private static toByte(view: DataView, offset: number, value: number): number {
    view.setInt32(offset, value, true);
    return offset + 4;
  }

  public static exportMap(mapData: MapData): ArrayBuffer {
    // Prepare items array similar to Python version
    const items: Item[] = [
      // Version item
      new Item(0, ITEM_TYPES.VERSION, [1]),
      // Info item
      new Item(0, ITEM_TYPES.INFO, [1, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]),
    ];

    // Add image items
    const imageItems = mapData.items
      .filter(item => item.parsed && 'name' in item.parsed)
      .sort((a, b) => (a.parsed as any).name.localeCompare((b.parsed as any).name));

    imageItems.forEach((item, i) => {
      items.push(new Item(i, ITEM_TYPES.IMAGE, [1, 1024, 1024, 1, i, 0xffffffff]));
    });

    // Add group item
    const layerItems = mapData.items
      .filter(item => item.parsed && 'tileData' in item.parsed)
      .sort((a, b) => {
        const aData = a.parsed as TileLayerItem;
        const bData = b.parsed as TileLayerItem;
        return aData.type - bData.type;
      });

    const nameEmpty = [0x80808080, 0x80808080, 0x80808000];
    const nameGame = [3353472485, 0x80808080, 0x80808000];
    items.push(new Item(0, ITEM_TYPES.GROUP, [3, 0, 0, 100, 100, 0, layerItems.length, 0, 0, 0, 0, 0, ...nameGame]));

    // Add layer items
    layerItems.forEach((item, i) => {
      if (!item.parsed || !('tileData' in item.parsed)) return;
      const layer = item.parsed as TileLayerItem;
      items.push(new Item(i, ITEM_TYPES.LAYER, [
        0, 2, 0,  // header
        3, layer.width, layer.height, i === 0 ? 1 : 0,  // version, width, height, flags
        255, 255, 255, 255,  // color
        0xffffffff, 0, i === 0 ? imageItems.length : i - 1, imageItems.length + i,  // colorenv, image, data
        ...(i === 0 ? nameGame : nameEmpty),  // name
        0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff  // reserved
      ]));
    });

    // Add envpoint item at end
    items.push(new Item(0, ITEM_TYPES.ENVPOINT, []));

    // Prepare data array
    const data: Uint8Array[] = [];
    
    // Add image names
    imageItems.forEach(item => {
      if (!item.parsed || !('name' in item.parsed)) return;
      const encoder = new TextEncoder();
      data.push(encoder.encode(item.parsed.name + '\0'));
    });

    // Add layer data
    layerItems.forEach(item => {
      if (!item.parsed || !('tileData' in item.parsed)) return;
      const layer = item.parsed as TileLayerItem;
      const layerData = new Uint8Array(layer.width * layer.height * 4);
      layer.tileData?.forEach((tile, i) => {
        const offset = i * 4;
        layerData[offset] = tile.id;
        layerData[offset + 1] = tile.flags;
        layerData[offset + 2] = tile.skip;
        layerData[offset + 3] = tile.reserved;
      });
      data.push(layerData);
    });

    // Compress data
    const compressedData = data.map(d => pako.deflate(d));

    // Calculate itemtypes like Python version
    const itemtypes: [number, number, number][] = [];
    let itemsConsidered = 0;
    const itemtypesDict = new Map<number, number>();
    items.forEach(item => {
      itemtypesDict.set(item.type, (itemtypesDict.get(item.type) || 0) + 1);
    });
    Array.from(itemtypesDict.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([type, count]) => {
        itemtypes.push([type, itemsConsidered, count]);
        itemsConsidered += count;
      });

    // Calculate header sizes exactly like Python
    const itemAreaSize = items.reduce((sum, item) => sum + item.length, 0);
    const dataAreaSize = compressedData.reduce((sum, d) => sum + d.length, 0);
    const swaplen = 36 - 16 + 12 * itemtypes.length + 4 * items.length + 2 * 4 * data.length + itemAreaSize;
    const size = swaplen + dataAreaSize;

    // Create buffer and view
    const totalSize = 16 + size;  // 16 for signature and version
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write signature
    new TextEncoder().encode('DATA').forEach(byte => {
      view.setUint8(offset++, byte);
    });

    // Write header
    offset = this.toByte(view, offset, 4);  // version
    offset = this.toByte(view, offset, size);
    offset = this.toByte(view, offset, swaplen);
    offset = this.toByte(view, offset, itemtypes.length);
    offset = this.toByte(view, offset, items.length);
    offset = this.toByte(view, offset, data.length);
    offset = this.toByte(view, offset, itemAreaSize);
    offset = this.toByte(view, offset, dataAreaSize);

    // Write itemtypes
    itemtypes.forEach(([type, start, count]) => {
      offset = this.toByte(view, offset, type);
      offset = this.toByte(view, offset, start);
      offset = this.toByte(view, offset, count);
    });

    // Write item offsets
    let currentOffset = 0;
    items.forEach(item => {
      offset = this.toByte(view, offset, currentOffset);
      currentOffset += item.length;
    });

    // Write data offsets
    currentOffset = 0;
    compressedData.forEach(d => {
      offset = this.toByte(view, offset, currentOffset);
      currentOffset += d.length;
    });

    // Write uncompressed data lengths
    data.forEach(d => {
      offset = this.toByte(view, offset, d.length);
    });

    // Write items
    items.forEach(item => {
      offset = item.toByte(view, offset);
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
