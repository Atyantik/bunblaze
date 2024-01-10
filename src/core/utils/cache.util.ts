// cacheManager.js
import { LRUCache } from "lru-cache";
import { serializeToFile, deserializeFromFile } from "./storage.util";
import path from "path";
import os from "os";

// Extend or modify LRUCache options to suit your needs
interface CacheOptions {
	maxSize: number;
	sizeCalculation: (obj: ResponseCacheableObject) => number;
	allowStale: boolean;
}

export class CacheManager {
	private static instance: CacheManager | null = null;
	private cache: LRUCache<string, ResponseCacheableObject>;
	private filePath: string;

	static async initInstance(options: CacheOptions) {
		if (CacheManager.instance) {
			console.info("Cache already initiated. Use CacheManager.getInstance()");
			return;
		}
		CacheManager.instance = new CacheManager(options);
		await CacheManager.instance.loadCache();
		return CacheManager.instance;
	}

	// Method to reset the singleton instance (use only for testing)
	static resetInstanceForTesting() {
		CacheManager.instance = null;
	}

	static getCacheInstance() {
		if (!CacheManager.instance) {
			throw new Error(
				"CacheManager instance not initiated. Use CacheManager.initInstance(options: CacheOptions)",
			);
		}
		return CacheManager.instance.cache;
	}

	constructor(options: CacheOptions) {
		if (CacheManager.instance) {
			throw new Error(
				"CacheManager instance already created. Use CacheManager.getInstance()",
			);
		}

		this.cache = new LRUCache(options);
		this.filePath = path.join(os.tmpdir(), "cache.bin");
	}

	async loadCache() {
		try {
			const data = await deserializeFromFile(this.filePath);
			if (data.length) {
				this.cache.load(data);
			}
		} catch (ex) {
			console.log("Cache not found. Starting with empty cache.");
		}
	}

	async dumpCache() {
		const dump = this.cache.dump();
		if (dump.length) {
			await serializeToFile(dump, this.filePath);
		}
	}
}

// Export the getInstance method
export const getCacheInstance = CacheManager.getCacheInstance;
export const initCacheInstance = CacheManager.initInstance;
