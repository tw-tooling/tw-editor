import { MapData, MapItem, LayerType, TileLayerItem, ItemType } from '../types/map';

export class MapExporter {
  private static HEADER_SIZE = 36;
  private static ITEMTYPE_SIZE = 12;
  private static ITEM_SIZE = 8;

  public static exportMap(mapData: MapData): ArrayBuffer {
    // Ensure we have all required items in the correct order
    const mapCopy = this.prepareMapData(mapData);

    // Calculate item sizes and offsets
    const itemSizes: number[] = [];
    const itemOffsets: number[] = [];
    let currentItemOffset = 0;

    mapCopy.items.forEach(item => {
      const size = this.calculateItemDataSize(item) * 4; // Each data item is 4 bytes
      itemSizes.push(size);
      itemOffsets.push(currentItemOffset);
      currentItemOffset += this.ITEM_SIZE + size;
    });

    // Calculate data offsets
    const dataOffsets: number[] = [];
    let currentDataOffset = 0;
    const compressedData: ArrayBuffer[] = [];
    mapCopy.data.forEach(data => {
      dataOffsets.push(currentDataOffset);
      // TODO: Add zlib compression here
      compressedData.push(data);
      currentDataOffset += data.byteLength;
    });

    // Calculate total size
    const itemTypesSize = mapCopy.itemTypes.length * this.ITEMTYPE_SIZE;
    const itemOffsetsSize = mapCopy.items.length * 4;
    const dataOffsetsSize = mapCopy.data.length * 4;
    const dataSizesSize = mapCopy.data.length * 4;
    const itemAreaSize = currentItemOffset;
    const dataAreaSize = currentDataOffset;

    const headerAndMetadataSize = this.HEADER_SIZE + itemTypesSize + itemOffsetsSize + dataOffsetsSize + dataSizesSize;
    const totalSize = headerAndMetadataSize + itemAreaSize + dataAreaSize;

    // Create buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write "DATA" signature
    view.setUint8(offset++, 68); // 'D'
    view.setUint8(offset++, 65); // 'A'
    view.setUint8(offset++, 84); // 'T'
    view.setUint8(offset++, 65); // 'A'

    // Write header
    view.setInt32(offset, 4, true); offset += 4; // version
    view.setInt32(offset, totalSize - 16, true); offset += 4; // size (everything after size field)
    view.setInt32(offset, headerAndMetadataSize + itemAreaSize - 16, true); offset += 4; // swaplen
    view.setInt32(offset, mapCopy.itemTypes.length, true); offset += 4; // num_item_types
    view.setInt32(offset, mapCopy.items.length, true); offset += 4; // num_items
    view.setInt32(offset, mapCopy.data.length, true); offset += 4; // num_data
    view.setInt32(offset, itemAreaSize, true); offset += 4; // item_size
    view.setInt32(offset, dataAreaSize, true); offset += 4; // data_size

    // Write item types
    mapCopy.itemTypes.forEach(type => {
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
    dataOffsets.forEach(dataOffset => {
      view.setInt32(offset, dataOffset, true);
      offset += 4;
    });

    // Write data sizes (uncompressed)
    mapCopy.data.forEach(data => {
      view.setInt32(offset, data.byteLength, true);
      offset += 4;
    });

    // Write items
    mapCopy.items.forEach((item, index) => {
      // Write type and ID
      view.setInt32(offset, item.typeAndId, true);
      offset += 4;

      // Write size
      view.setInt32(offset, itemSizes[index], true);
      offset += 4;

      // Write item data
      if (item.parsed) {
        this.writeItemData(view, offset, item);
        offset += itemSizes[index];
      }
    });

    // Write data
    compressedData.forEach(data => {
      const dataView = new Uint8Array(data);
      const targetView = new Uint8Array(buffer, offset, data.byteLength);
      targetView.set(dataView);
      offset += data.byteLength;
    });

    return buffer;
  }

  private static prepareMapData(mapData: MapData): MapData {
    const items: MapItem[] = [];
    
    // Add version item
    items.push({
      typeAndId: (ItemType.VERSION << 16) | 0,
      size: 4,
      data: new ArrayBuffer(4),
      parsed: { version: 1 }
    });

    // Add info item
    items.push({
      typeAndId: (ItemType.INFO << 16) | 0,
      size: 24,
      data: new ArrayBuffer(24),
      parsed: {
        author: "",
        version: "1",
        credits: "",
        license: "",
        settings: []
      }
    });

    // Add existing items
    items.push(...mapData.items);

    // Add envpoint item at the end
    items.push({
      typeAndId: (ItemType.ENVPOINT << 16) | 0,
      size: 0,
      data: new ArrayBuffer(0),
      parsed: undefined
    });

    // Update item types
    const typeMap = new Map<number, { start: number, count: number }>();
    items.forEach((item, index) => {
      const type = item.typeAndId >> 16;
      if (!typeMap.has(type)) {
        typeMap.set(type, { start: index, count: 1 });
      } else {
        const info = typeMap.get(type)!;
        info.count++;
      }
    });

    const itemTypes = Array.from(typeMap.entries()).map(([typeId, info]) => ({
      typeId,
      start: info.start,
      num: info.count
    }));

    return {
      ...mapData,
      items,
      itemTypes,
    };
  }

  private static calculateItemDataSize(item: MapItem): number {
    if (!item.parsed) return 0;
    
    const type = item.typeAndId >> 16;
    switch (type) {
      case ItemType.VERSION:
        return 1; // [version]
      case ItemType.INFO:
        return 6; // [version, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]
      case ItemType.LAYER:
        if ('tileData' in item.parsed) {
          const layer = item.parsed as TileLayerItem;
          return 3 + (layer.width * layer.height); // [version, type, flags] + tile data
        }
        return 0;
      default:
        return 0;
    }
  }

  private static writeItemData(view: DataView, offset: number, item: MapItem): void {
    const type = item.typeAndId >> 16;
    
    switch (type) {
      case ItemType.VERSION:
        view.setInt32(offset, 1, true); // version 1
        break;
      case ItemType.INFO:
        view.setInt32(offset, 1, true); // version 1
        for (let i = 0; i < 5; i++) {
          view.setInt32(offset + 4 + (i * 4), 0xffffffff, true);
        }
        break;
      case ItemType.LAYER:
        if ('tileData' in item.parsed) {
          const layer = item.parsed as TileLayerItem;
          // Write layer header
          view.setInt32(offset, layer.version, true);
          view.setInt32(offset + 4, layer.type, true);
          view.setInt32(offset + 8, layer.flags, true);
          // Write tile data
          offset += 12;
          layer.tileData?.forEach((tile, i) => {
            const tileOffset = offset + (i * 4);
            view.setUint8(tileOffset, tile.id);
            view.setUint8(tileOffset + 1, tile.flags);
            view.setUint8(tileOffset + 2, tile.skip);
            view.setUint8(tileOffset + 3, tile.reserved);
          });
        }
        break;
    }
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