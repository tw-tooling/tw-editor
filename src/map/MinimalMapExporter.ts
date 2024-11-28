import { ItemType, LayerType } from '../types/map';
import pako from 'pako';

interface MinimalItem {
  typeAndId: number;
  data: number[];
}

export class MinimalMapExporter {
  private static HEADER_SIZE = 36;
  private static ITEMTYPE_SIZE = 12;
  private static ITEM_SIZE = 8;

  public static exportMinimalMap(): ArrayBuffer {
    // Create minimal items array with data as integer arrays
    const items: MinimalItem[] = [
      // Version item
      {
        typeAndId: (ItemType.VERSION << 16) | 0,
        data: [1]  // version 1
      },
      // Info item
      {
        typeAndId: (ItemType.INFO << 16) | 0,
        data: [1, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]  // version 1 + empty strings
      },
      // Image item (grass_main)
      {
        typeAndId: (ItemType.IMAGE << 16) | 0,
        data: [1, 1024, 1024, 1, 0, 0xffffffff]  // version, width, height, external, image_id, name
      },
      // Group item
      {
        typeAndId: (ItemType.GROUP << 16) | 0,
        data: [3, 0, 0, 100, 100, 0, 1, 0, 0, 0, 0, 0, 0x80808080, 0x80808080, 0x80808000]  // version, offsets, parallax, layers, clipping, name
      },
      // Game layer
      {
        typeAndId: (ItemType.LAYER << 16) | 0,
        data: [
          0, LayerType.TILES, 0,  // header
          3, 50, 50, 1,  // version, width, height, flags
          255, 255, 255, 255,  // color
          0xffffffff, 0, 0xffffffff, 0,  // color env, image, data
          0x80808080, 0x80808080, 0x80808000,  // name
          0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff  // reserved
        ]
      },
      // Envpoint item (empty end marker)
      {
        typeAndId: (ItemType.ENVPOINT << 16) | 0,
        data: []
      }
    ];

    // Create tile data (50x50 grid with tile ID 1)
    const tileData = new Uint8Array(50 * 50 * 4);
    for (let i = 0; i < 50 * 50; i++) {
      tileData[i * 4] = 1;      // id
      tileData[i * 4 + 1] = 0;  // flags
      tileData[i * 4 + 2] = 0;  // skip
      tileData[i * 4 + 3] = 0;  // reserved
    }

    // Compress tile data
    const compressedData = [pako.deflate(tileData)];

    // Calculate item types
    const itemTypes = [
      { typeId: ItemType.VERSION, start: 0, num: 1 },
      { typeId: ItemType.INFO, start: 1, num: 1 },
      { typeId: ItemType.IMAGE, start: 2, num: 1 },
      { typeId: ItemType.GROUP, start: 3, num: 1 },
      { typeId: ItemType.LAYER, start: 4, num: 1 },
      { typeId: ItemType.ENVPOINT, start: 5, num: 1 }
    ];

    // Calculate item offsets and sizes
    const itemOffsets: number[] = [];
    let currentOffset = 0;
    items.forEach(item => {
      itemOffsets.push(currentOffset);
      currentOffset += (item.data.length + 2) * 4;  // +2 for typeAndId and size
    });

    // Calculate data offsets
    const dataOffsets: number[] = [0];
    const itemAreaSize = currentOffset;
    const dataAreaSize = compressedData[0].length;

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
    dataOffsets.forEach(dataOffset => {
      view.setInt32(offset, dataOffset, true);
      offset += 4;
    });

    // Write data sizes (uncompressed)
    view.setInt32(offset, tileData.length, true);
    offset += 4;

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
    new Uint8Array(buffer, offset, compressedData[0].length).set(compressedData[0]);

    return buffer;
  }
} 