import { test, expect, beforeAll } from 'bun:test';
import {
	getCacheInstance,
	CacheManager,
} from "../../../utils/cache.util";

beforeAll(() => {
    CacheManager.resetInstanceForTesting();
});

test("CacheManager throws error if not initialized", () => {
    expect(() => getCacheInstance()).toThrow("CacheManager instance not initiated");
});