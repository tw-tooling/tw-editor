import { MapData, MapItem, LayerType, TileLayerItem, ItemType, ImageItem } from '../types/map';
import pako from 'pako';

export class MapExporter {
  private static HEADER_SIZE = 36;
  private static ITEMTYPE_SIZE = 12;
  private static ITEM_SIZE = 8;

  private static debug(msg: string, ...args: any[]) {
    console.log(`[MapExporter] ${msg}`, ...args);
  }

  public static exportMap(mapData: MapData): ArrayBuffer {
    // Ensure we have all required items in the correct order
    const mapCopy = this.prepareMapData(mapData);

    // Extract image names and create their byte arrays
    const imageItems = mapCopy.items.filter(item => (item.typeAndId >> 16) === ItemType.IMAGE);
    const imageData = imageItems.map(item => {
      if (!item.parsed || !('name' in item.parsed)) return new Uint8Array(0);
      const encoder = new TextEncoder();
      return encoder.encode(item.parsed.name + '\0');
    });

    this.debug('Image data:', imageData.map(d => d.length));

    // Create data array in same order as Python example
    const data: Uint8Array[] = [
      ...imageData,  // Image names first
    ];

    // Add layer data
    let layerCount = 0;
    mapCopy.items.forEach(item => {
      const type = item.typeAndId >> 16;
      if (type === ItemType.LAYER && item.parsed && 'tileData' in item.parsed) {
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
        layerCount++;
      }
    });

    this.debug('Layer count:', layerCount);
    this.debug('Data lengths:', data.map(d => d.length));

    // Compress all data
    const compressedData = data.map(d => pako.deflate(d));
    this.debug('Compressed data lengths:', compressedData.map(d => d.length));

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

    this.debug('Item sizes:', itemSizes);
    this.debug('Item offsets:', itemOffsets);

    // Calculate data offsets
    const dataOffsets: number[] = [];
    let currentDataOffset = 0;
    compressedData.forEach(data => {
      dataOffsets.push(currentDataOffset);
      currentDataOffset += data.length;
    });

    this.debug('Data offsets:', dataOffsets);

    const itemAreaSize = currentItemOffset;
    const dataAreaSize = currentDataOffset;

    // Calculate total size
    const itemTypesSize = mapCopy.itemTypes.length * this.ITEMTYPE_SIZE;
    const itemOffsetsSize = mapCopy.items.length * 4;
    const dataOffsetsSize = compressedData.length * 4;
    const dataSizesSize = compressedData.length * 4;
    const headerAndMetadataSize = this.HEADER_SIZE + itemTypesSize + itemOffsetsSize + dataOffsetsSize + dataSizesSize;
    const totalSize = headerAndMetadataSize + itemAreaSize + dataAreaSize;

    this.debug('Sizes:', {
      itemTypesSize,
      itemOffsetsSize,
      dataOffsetsSize,
      dataSizesSize,
      headerAndMetadataSize,
      itemAreaSize,
      dataAreaSize,
      totalSize
    });

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
    view.setInt32(offset, mapCopy.itemTypes.length, true); offset += 4; // num_item_types
    view.setInt32(offset, mapCopy.items.length, true); offset += 4; // num_items
    view.setInt32(offset, compressedData.length, true); offset += 4; // num_data
    view.setInt32(offset, itemAreaSize, true); offset += 4; // item_size
    view.setInt32(offset, dataAreaSize, true); offset += 4; // data_size

    this.debug('After header offset:', offset);

    // Write item types
    mapCopy.itemTypes.forEach(type => {
      view.setInt32(offset, type.typeId, true); offset += 4;
      view.setInt32(offset, type.start, true); offset += 4;
      view.setInt32(offset, type.num, true); offset += 4;
    });

    this.debug('After item types offset:', offset);

    // Write item offsets
    itemOffsets.forEach(itemOffset => {
      view.setInt32(offset, itemOffset, true);
      offset += 4;
    });

    this.debug('After item offsets offset:', offset);

    // Write data offsets
    dataOffsets.forEach(dataOffset => {
      view.setInt32(offset, dataOffset, true);
      offset += 4;
    });

    this.debug('After data offsets offset:', offset);

    // Write data sizes (uncompressed)
    data.forEach(d => {
      view.setInt32(offset, d.length, true);
      offset += 4;
    });

    this.debug('After data sizes offset:', offset);

    // Write items
    const itemsStartOffset = offset;
    mapCopy.items.forEach((item, index) => {
      const itemOffset = itemsStartOffset + itemOffsets[index];
      this.debug(`Writing item ${index} at offset ${itemOffset}, size ${itemSizes[index]}`);
      
      // Write type and size
      view.setInt32(itemOffset, item.typeAndId, true);
      view.setInt32(itemOffset + 4, itemSizes[index] / 4, true);

      if (!item.parsed) return;

      const type = item.typeAndId >> 16;
      let currentOffset = itemOffset + 8;

      switch (type) {
        case ItemType.VERSION:
          if ('version' in item.parsed) {
            view.setInt32(currentOffset, 1, true); // Always version 1
          }
          break;

        case ItemType.INFO:
          if ('version' in item.parsed) {
            view.setInt32(currentOffset, 1, true); // Always version 1
            currentOffset += 4;
            // Write empty strings
            for (let i = 0; i < 5; i++) {
              view.setInt32(currentOffset + (i * 4), -1, true);
            }
          }
          break;

        case ItemType.IMAGE:
          if ('width' in item.parsed) {
            const imageIndex = imageItems.findIndex(img => img === item);
            view.setInt32(currentOffset, 1, true); // version
            currentOffset += 4;
            view.setInt32(currentOffset, item.parsed.width, true);
            currentOffset += 4;
            view.setInt32(currentOffset, item.parsed.height, true);
            currentOffset += 4;
            view.setInt32(currentOffset, 1, true); // external
            currentOffset += 4;
            view.setInt32(currentOffset, imageIndex, true); // image index
            currentOffset += 4;
            view.setInt32(currentOffset, imageIndex, true); // name data index
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
            // Write name (3 ints)
            for (let i = 0; i < 3; i++) {
              view.setInt32(currentOffset + (i * 4), -1, true);
            }
          }
          break;

        case ItemType.LAYER:
          if ('tileData' in item.parsed) {
            const layer = item.parsed as TileLayerItem;
            const layerIndex = imageData.length + (index - (mapCopy.items.length - layerCount));

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
            view.setInt32(currentOffset, layer.image, true); // image
            currentOffset += 4;
            view.setInt32(currentOffset, layerIndex, true); // data index
            currentOffset += 4;

            // Write name (3 ints)
            for (let i = 0; i < 3; i++) {
              view.setInt32(currentOffset + (i * 4), -1, true);
            }
            currentOffset += 12;

            // Write reserved (5 ints)
            for (let i = 0; i < 5; i++) {
              view.setInt32(currentOffset + (i * 4), -1, true);
            }
          }
          break;
      }
    });

    offset = itemsStartOffset + itemAreaSize;
    this.debug('After items offset:', offset);

    // Write compressed data
    const dataStartOffset = offset;
    compressedData.forEach((data, i) => {
      const dataOffset = dataStartOffset + dataOffsets[i];
      this.debug(`Writing compressed data ${i} at offset ${dataOffset}, length ${data.length}`);
      new Uint8Array(buffer, dataOffset, data.length).set(data);
    });

    offset = dataStartOffset + dataAreaSize;
    this.debug('Final offset:', offset);
    this.debug('Buffer size:', buffer.byteLength);

    return buffer;
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
          return 6; // [version, width, height, external, image_id, name_data]
        }
        return 0;
      case ItemType.GROUP:
        if ('offsetX' in item.parsed) {
          return 15; // version, offsets, parallax, layers, clipping, name (3 ints)
        }
        return 0;
      case ItemType.LAYER:
        if ('tileData' in item.parsed) {
          const layer = item.parsed as TileLayerItem;
          return 20; // header + info + color + env + name + reserved
        }
        return 0;
      default:
        return 0;
    }
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
        version: "1",
        author: "",
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