import { MapHeader, ItemTypeInfo, MapItem, MapData, VersionItem, InfoItem, ImageItem, GroupItem, LayerItem, LayerType, ItemType } from '../types/map';

export class MapReader {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  public read(): MapData {
    const header = this.readHeader();
    
    // Read item types
    const itemTypes: ItemTypeInfo[] = [];
    for (let i = 0; i < header.numItemTypes; i++) {
      itemTypes.push(this.readItemType());
    }

    // Read offsets
    const itemOffsets = this.readOffsets(header.numItems);
    const dataOffsets = this.readOffsets(header.numData);
    
    // Read data sizes (version 4 only)
    const dataSizes = header.version === 4 ? 
      this.readOffsets(header.numData) : undefined;

    // Read items
    const items: MapItem[] = [];
    for (let i = 0; i < header.numItems; i++) {
      items.push(this.readItem());
    }

    // Read data blocks
    const data: ArrayBuffer[] = [];
    for (let i = 0; i < header.numData; i++) {
      const size = i < header.numData - 1 ? 
        dataOffsets[i + 1] - dataOffsets[i] :
        header.dataSize - dataOffsets[i];
        
      data.push(this.readData(size));
    }

    return {
      header,
      itemTypes,
      itemOffsets,
      dataOffsets,
      dataSizes,
      items,
      data
    };
  }

  private readHeader(): MapHeader {
    // Read and verify signature
    const signature = new Uint8Array(this.buffer, this.offset, 4);
    this.offset += 4;
    
    if (!this.isValidSignature(signature)) {
      throw new Error('Invalid map file signature');
    }

    return {
      signature,
      version: this.readInt32(),
      size: this.readInt32(),
      swapLen: this.readInt32(),
      numItemTypes: this.readInt32(),
      numItems: this.readInt32(), 
      numData: this.readInt32(),
      itemSize: this.readInt32(),
      dataSize: this.readInt32()
    };
  }

  private readItemType(): ItemTypeInfo {
    return {
      typeId: this.readInt32(),
      start: this.readInt32(),
      num: this.readInt32()
    };
  }

  private readItem(): MapItem {
    const typeAndId = this.readInt32();
    const size = this.readInt32();
    const data = this.buffer.slice(this.offset, this.offset + size);
    this.offset += size;

    return { typeAndId, size, data };
  }

  private readOffsets(count: number): number[] {
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) {
      offsets.push(this.readInt32());
    }
    return offsets;
  }

  private readData(size: number): ArrayBuffer {
    const data = this.buffer.slice(this.offset, this.offset + size);
    this.offset += size;
    return data;
  }

  private readInt32(): number {
    const value = this.view.getInt32(this.offset, true); // little endian
    this.offset += 4;
    return value;
  }

  private isValidSignature(sig: Uint8Array): boolean {
    const valid = new TextEncoder().encode('DATA');
    const reversed = new TextEncoder().encode('ATAD');
    
    return (
      sig.every((b, i) => b === valid[i]) ||
      sig.every((b, i) => b === reversed[i])
    );
  }

  private parseItem(item: MapItem): void {
    const type = item.typeAndId >> 16;
    const view = new DataView(item.data);
    let offset = 0;

    switch (type) {
      case ItemType.VERSION:
        item.parsed = this.parseVersionItem(view);
        break;
      case ItemType.INFO:
        item.parsed = this.parseInfoItem(view);
        break;
      case ItemType.IMAGE:
        item.parsed = this.parseImageItem(view);
        break;
      case ItemType.GROUP:
        item.parsed = this.parseGroupItem(view);
        break;
      case ItemType.LAYER:
        item.parsed = this.parseLayerItem(view);
        break;
    }
  }

  private parseVersionItem(view: DataView): VersionItem {
    return {
      version: view.getInt32(0, true)
    };
  }

  private parseInfoItem(view: DataView): InfoItem {
    // Strings are stored as null-terminated UTF-16
    const decoder = new TextDecoder('utf-16le');
    let offset = 0;
    
    const readString = (): string => {
      let end = offset;
      while (view.getUint16(end, true) !== 0) end += 2;
      const str = decoder.decode(new Uint8Array(view.buffer.slice(offset, end)));
      offset = end + 2;
      return str;
    };

    return {
      author: readString(),
      version: readString(),
      credits: readString(),
      license: readString(),
      settings: []  // Parse additional settings if needed
    };
  }

  private parseImageItem(view: DataView): ImageItem {
    return {
      width: view.getInt32(0, true),
      height: view.getInt32(4, true),
      external: view.getInt32(8, true) !== 0,
      name: this.readString(view, 12),
      data: view.getInt32(view.byteLength - 4, true)
    };
  }

  private parseGroupItem(view: DataView): GroupItem {
    return {
      offsetX: view.getInt32(0, true),
      offsetY: view.getInt32(4, true),
      parallaxX: view.getInt32(8, true),
      parallaxY: view.getInt32(12, true),
      startLayer: view.getInt32(16, true),
      numLayers: view.getInt32(20, true),
      useClipping: view.getInt32(24, true),
      clipX: view.getInt32(28, true),
      clipY: view.getInt32(32, true),
      clipW: view.getInt32(36, true),
      clipH: view.getInt32(40, true),
      name: this.readString(view, 44)
    };
  }

  private parseLayerItem(view: DataView): LayerItem {
    const type = view.getInt32(0, true);
    const flags = view.getInt32(4, true);

    switch (type) {
      case LayerType.TILES:
        return this.parseTileLayerItem(view);
      case LayerType.QUADS:
        return this.parseQuadLayerItem(view);
      default:
        return { type, flags };
    }
  }

  private readString(view: DataView, offset: number): string {
    const decoder = new TextDecoder('utf-16le');
    let end = offset;
    while (view.getUint16(end, true) !== 0) end += 2;
    return decoder.decode(new Uint8Array(view.buffer.slice(offset, end)));
  }
} 