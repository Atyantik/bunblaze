import { LRUCache } from "lru-cache";
import path from 'path';
import os from 'os';
import { getFreeMemoryInBytes } from "./memory.util";
import { deserializeFromFile, serializeToFile } from "./storage.util";

const tempFilePath = path.join(os.tmpdir(), 'cache.bin');
console.log(tempFilePath);

Bun.gc(true);
const availableBytes = await getFreeMemoryInBytes();
// 70% of memory 
const usableBytes = Math.floor(availableBytes * 0.7);

export function sizeOf(obj: HeadersEntryType[]) {
  const stringifiedObject = JSON.stringify(obj);
  const sizeInBytes = new Blob([stringifiedObject]).size;
  return sizeInBytes;
}

const options = {
  maxSize: usableBytes,
  sizeCalculation: (value: {
    body: Uint8Array;
    status: number;
    headers: HeadersEntryType[];
  }) => {
    return value.body.length + sizeOf(value.headers) + 50;
  },

  // return stale items before removing from cache?
  allowStale: true,
}

/**
 * When initializing the cache, load from file
 */
export const cache = new LRUCache(options);
const previousCacheData = deserializeFromFile(tempFilePath);
if (previousCacheData.length) {
  cache.load(previousCacheData);
}

/**
 * Save cache to file every 5 seconds
 */
let dumping = false;
setInterval(() => {
  if (dumping) return;
  dumping = true;
  const dump = cache.dump();
  if (dump.length) {
    serializeToFile(dump as unknown as DataArray[], tempFilePath);
  }
  dumping = false;
}, 5000);
