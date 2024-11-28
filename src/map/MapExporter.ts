import { MapData, MapItem, LayerType, TileLayerItem, ItemType, ImageItem } from '../types/map';

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
      currentItemOffset += size;
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
    const signature = new TextEncoder().encode('DATA');
    new Uint8Array(buffer, offset, 4).set(signature);
    offset += 4;

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
      // Write item data
      if (item.parsed) {
        const type = item.typeAndId >> 16;
        switch (type) {
          case ItemType.VERSION:
            view.setInt32(offset, 1, true); // version 1
            offset += 4;
            break;

          case ItemType.INFO:
            view.setInt32(offset, 1, true); // version 1
            offset += 4;
            for (let i = 0; i < 5; i++) {
              view.setInt32(offset, 0xffffffff, true);
              offset += 4;
            }
            break;

          case ItemType.IMAGE:
            const img = item.parsed as ImageItem;
            view.setInt32(offset, 1, true); // version
            offset += 4;
            view.setInt32(offset, img.width, true);
            offset += 4;
            view.setInt32(offset, img.height, true);
            offset += 4;
            view.setInt32(offset, img.external ? 1 : 0, true);
            offset += 4;
            view.setInt32(offset, img.data, true); // image index
            offset += 4;
            view.setInt32(offset, 0xffffffff, true); // name data
            offset += 4;
            break;

          case ItemType.GROUP:
            if ('offsetX' in item.parsed) {
              view.setInt32(offset, 3, true); // version
              offset += 4;
              view.setInt32(offset, item.parsed.offsetX, true);
              offset += 4;
              view.setInt32(offset, item.parsed.offsetY, true);
              offset += 4;
              view.setInt32(offset, item.parsed.parallaxX, true);
              offset += 4;
              view.setInt32(offset, item.parsed.parallaxY, true);
              offset += 4;
              view.setInt32(offset, item.parsed.startLayer, true);
              offset += 4;
              view.setInt32(offset, item.parsed.numLayers, true);
              offset += 4;
              view.setInt32(offset, item.parsed.useClipping, true);
              offset += 4;
              view.setInt32(offset, item.parsed.clipX, true);
              offset += 4;
              view.setInt32(offset, item.parsed.clipY, true);
              offset += 4;
              view.setInt32(offset, item.parsed.clipW, true);
              offset += 4;
              view.setInt32(offset, item.parsed.clipH, true);
              offset += 4;
              // Write name
              for (let i = 0; i < 3; i++) {
                view.setInt32(offset, 0x80808080, true);
                offset += 4;
              }
            }
            break;

          case ItemType.LAYER:
            if ('tileData' in item.parsed) {
              const layer = item.parsed as TileLayerItem;

              // Write layer header
              view.setInt32(offset, 3, true); // version
              offset += 4;
              view.setInt32(offset, layer.type, true);
              offset += 4;
              view.setInt32(offset, layer.flags, true);
              offset += 4;

              // Write layer info
              view.setInt32(offset, layer.width, true);
              offset += 4;
              view.setInt32(offset, layer.height, true);
              offset += 4;
              view.setInt32(offset, layer.flags, true);
              offset += 4;

              // Write color
              view.setInt32(offset, layer.color.r, true);
              offset += 4;
              view.setInt32(offset, layer.color.g, true);
              offset += 4;
              view.setInt32(offset, layer.color.b, true);
              offset += 4;
              view.setInt32(offset, layer.color.a, true);
              offset += 4;

              // Write color env and image
              view.setInt32(offset, -1, true); // colorEnv
              offset += 4;
              view.setInt32(offset, 0, true); // colorEnvOffset
              offset += 4;
              view.setInt32(offset, 0, true); // image (reference to first image)
              offset += 4;
              view.setInt32(offset, 0, true); // data
              offset += 4;

              // Write name (3 ints)
              for (let i = 0; i < 3; i++) {
                view.setInt32(offset, 0x80808080, true);
                offset += 4;
              }

              // Write reserved (5 ints)
              for (let i = 0; i < 5; i++) {
                view.setInt32(offset, 0xffffffff, true);
                offset += 4;
              }

              // Write tile data
              layer.tileData?.forEach((tile, i) => {
                const tileOffset = offset + (i * 4);
                view.setUint8(tileOffset, tile.id);
                view.setUint8(tileOffset + 1, tile.flags);
                view.setUint8(tileOffset + 2, tile.skip);
                view.setUint8(tileOffset + 3, tile.reserved);
              });
              offset += layer.width * layer.height * 4;
            }
            break;
        }
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

    // Add image item (default game tileset)
    items.push({
      typeAndId: (ItemType.IMAGE << 16) | 0,
      size: 24,
      data: new ArrayBuffer(24),
      parsed: {
        version: 1,
        width: 1024,
        height: 1024,
        external: true,
        imageIndex: 0,
        name: "grass_main"
      }
    });

    // Add group item
    items.push({
      typeAndId: (ItemType.GROUP << 16) | 0,
      size: 60,
      data: new ArrayBuffer(60),
      parsed: {
        version: 3,
        offsetX: 0,
        offsetY: 0,
        parallaxX: 100,
        parallaxY: 100,
        startLayer: 0,
        numLayers: mapData.items.length + 1,
        useClipping: 0,
        clipX: 0,
        clipY: 0,
        clipW: 0,
        clipH: 0,
        name: "Game"
      }
    });

    // Add game layer
    items.push({
      typeAndId: (ItemType.LAYER << 16) | 0,
      size: 0,
      data: new ArrayBuffer(0),
      parsed: {
        type: LayerType.GAME,
        flags: 0,
        version: 0,
        width: 50,
        height: 50,
        color: { r: 255, g: 255, b: 255, a: 255 },
        colorEnv: -1,
        colorEnvOffset: 0,
        image: -1,
        data: 0,
        name: "Game",
        tileData: new Array(50 * 50).fill({ id: 0, flags: 0, skip: 0, reserved: 0 })
      }
    });

    // Add existing layer items
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

    const itemTypes = Array.from(typeMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([typeId, info]) => ({
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
      case ItemType.IMAGE:
        if ('width' in item.parsed) {
          // [version, width, height, external, imageIndex, 0xffffffff]
          return 6;
        }
        return 0;
      case ItemType.GROUP:
        if ('offsetX' in item.parsed) {
          // version, offsets, parallax, layers, clipping, name (3 ints)
          return 12 + 3;
        }
        return 0;
      case ItemType.LAYER:
        if ('tileData' in item.parsed) {
          const layer = item.parsed as TileLayerItem;
          // [version, type, flags, width, height, flags, color(r,g,b,a), colorEnv, colorEnvOffset, image, data] + name (3) + reserved (5)
          return 15 + 3 + 5 + (layer.width * layer.height);
        }
        return 0;
      default:
        return 0;
    }
  }

  private static writeItemData(view: DataView, offset: number, item: MapItem): void {
    if (!item.parsed) return;

    const type = item.typeAndId >> 16;
    let currentOffset = offset;
    
    switch (type) {
      case ItemType.VERSION:
        view.setInt32(currentOffset, 1, true); // version 1
        break;

      case ItemType.INFO:
        view.setInt32(currentOffset, 1, true); // version 1
        for (let i = 0; i < 5; i++) {
          view.setInt32(currentOffset + 4 + (i * 4), 0xffffffff, true);
        }
        break;

      case ItemType.IMAGE:
        if ('width' in item.parsed) {
          view.setInt32(currentOffset, item.parsed.version, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.width, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.height, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.external ? 1 : 0, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.imageIndex, true);
          currentOffset += 4;
          view.setInt32(currentOffset, 0xffffffff, true); // name data
        }
        break;

      case ItemType.GROUP:
        if ('offsetX' in item.parsed) {
          view.setInt32(currentOffset, 3, true); // version
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.offsetX, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.offsetY, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.parallaxX, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.parallaxY, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.startLayer, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.numLayers, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.useClipping, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.clipX, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.clipY, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.clipW, true);
          currentOffset += 4;
          view.setInt32(currentOffset, item.parsed.clipH, true);
          currentOffset += 4;
          // Write name as fixed 3 ints
          for (let i = 0; i < 3; i++) {
            view.setInt32(currentOffset, 0x80808080, true);
            currentOffset += 4;
          }
        }
        break;

      case ItemType.LAYER:
        if ('tileData' in item.parsed) {
          const layer = item.parsed as TileLayerItem;

          // Write layer header
          view.setInt32(currentOffset, 3, true); // version
          currentOffset += 4;
          view.setInt32(currentOffset, layer.type, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.flags, true);
          currentOffset += 4;

          // Write layer info
          view.setInt32(currentOffset, layer.width, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.height, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.flags, true);
          currentOffset += 4;

          // Write color
          view.setInt32(currentOffset, layer.color.r, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.color.g, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.color.b, true);
          currentOffset += 4;
          view.setInt32(currentOffset, layer.color.a, true);
          currentOffset += 4;

          // Write color env and image
          view.setInt32(currentOffset, -1, true); // colorEnv
          currentOffset += 4;
          view.setInt32(currentOffset, 0, true); // colorEnvOffset
          currentOffset += 4;
          view.setInt32(currentOffset, 0, true); // image (reference to first image)
          currentOffset += 4;
          view.setInt32(currentOffset, 0, true); // data
          currentOffset += 4;

          // Write name (3 ints)
          for (let i = 0; i < 3; i++) {
            view.setInt32(currentOffset, 0x80808080, true);
            currentOffset += 4;
          }

          // Write reserved (5 ints)
          for (let i = 0; i < 5; i++) {
            view.setInt32(currentOffset, 0xffffffff, true);
            currentOffset += 4;
          }

          // Write tile data
          layer.tileData?.forEach((tile, i) => {
            const tileOffset = currentOffset + (i * 4);
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