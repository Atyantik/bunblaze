import {
	test,
	expect,
	spyOn,
	beforeAll,
	describe,
} from "bun:test";
import {
	initCacheInstance,
	getCacheInstance,
	CacheManager,
} from "../../../utils/cache.util";
import * as storageUtils from "../../../utils/storage.util";
import path from "path";
import os from "os";
import { serialize } from "bun:jsc";

spyOn(storageUtils, "serializeToFile");
spyOn(storageUtils, "deserializeFromFile");

function sizeOf(obj: ResponseCacheableObject): number {
	const serializedObj = serialize(obj);
	return serializedObj.byteLength + 50;
}

const mockCacheData: ResponseCacheableObject = {
	body: new Uint8Array(Buffer.from("Hello, World")),
	status: 200,
	headers: [["content-type", "text/plain"]],
};

const cacheOptions = {
	maxSize: 2048,
	sizeCalculation: sizeOf,
	allowStale: true,
};

// Mocking file path
const cacheFilePath = path.join(os.tmpdir(), "cache.bin");

describe("CacheManager Tests", () => {
	describe("CacheManager with initialization", () => {
		let cacheManager: CacheManager | undefined;
		beforeAll(async () => {
			CacheManager.resetInstanceForTesting();
			cacheManager = await initCacheInstance(cacheOptions);
		});

		test("CacheManager initialization", async () => {
			const cache = getCacheInstance();
			expect(cache).toBeDefined();
		});

		test("CacheManager is a singleton", async () => {
			const cache1 = getCacheInstance();
			const cache2 = getCacheInstance();

			expect(cache1).toBe(cache2);
		});

		test("CacheManager persists data", async () => {
			const cache = getCacheInstance();

			// Simulate adding data to the cache
			cache.set("newKey", mockCacheData);

			// Simulate dumping cache to file
			// @ts-ignore
			await cacheManager.dumpCache();

			// Check if serializeToFile was called with the expected data
			expect(await Bun.file(cacheFilePath).exists()).toBe(true);
		});
	});
});
