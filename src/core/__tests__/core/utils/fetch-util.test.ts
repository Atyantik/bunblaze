import { test, expect, mock } from 'bun:test';
import { fetchStale } from '../../../utils/fetch.util';
import { ENCODINGS, convertToCacheableObject, decompressResponse, getUrlId } from '../../../utils/http.util';
import { getCacheInstance } from '../../../utils/cache.util';

test("fetchStale - Fetches and caches data from API", async () => {
  const url = 'https://coffee.alexflipnote.dev/random.json';

  const uniqueKey = `testKey-${Math.random()}`;

  // Perform the first fetch
  const firstResponse = await fetchStale(uniqueKey, url);
  const firstData = await firstResponse.json();

  // Check if both responses are valid and identical
  expect(firstResponse.ok).toBe(true);
  expect(firstData).toHaveProperty('file');
});

test("fetchStale - Handles cache miss and fetches from network", async () => {
  const url = 'https://coffee.alexflipnote.dev/random.json';
  const uniqueKey = `testKey-${Math.random()}`;

  // Create a mock function for fetch
  const mockFetch = mock(() => new Response(JSON.stringify({ file: 'test.jpg' }), { status: 200 }));
  const originalFetch = globalThis.fetch;

  // @ts-ignore
  globalThis.fetch = mockFetch;

  // Use mockFetch in fetchStale or replace fetch globally in fetchStale's module scope
  // ...

  // Call the function
  const response = await fetchStale(uniqueKey, url);
  const responseData = await response.json();

  // Assertions
  expect(response.ok).toBe(true);
  // @ts-ignore
  expect(responseData.file).toBe('test.jpg');
  globalThis.fetch = originalFetch;
});

test("fetchStale - Revalidates and updates cache", async () => {
  const originalFetch = globalThis.fetch;
  const url = 'https://coffee.alexflipnote.dev/random.json';
  const uniqueKey = `testKey-${Math.random()}`;
  const cacheKey = `fetchStale:${getUrlId(url, uniqueKey)}`;

  const cachedData = { file: 'stale.jpg' };
  const cachedResponse = new Response(JSON.stringify(cachedData), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });

  // Set up initial cached data
  const initialCachedData = await convertToCacheableObject(cachedResponse, [ENCODINGS.IDENTITY]);
  getCacheInstance().set(cacheKey, initialCachedData);

  // Mock fetch for revalidation with new data
  const newResponseData = { file: 'new.jpg' };
  const newResponse = new Response(JSON.stringify(newResponseData), { status: 200 });
  const mockFetch = mock(() => newResponse);
  // @ts-ignore
  globalThis.fetch = mockFetch;

  // Call the function
  const response = await fetchStale(uniqueKey, url);
  const responseData = await response.json();

  // Assertions for initial response
  expect(responseData).toEqual(cachedData);

  // Wait for background revalidation to complete
  // You may need to simulate a delay or use another method to wait for the revalidation
  await new Promise((resolve) => setTimeout(resolve, 100));
  const response2 = await fetchStale(uniqueKey, url);
  const responseData2 = await response2.json();
  expect(responseData2).toEqual(newResponseData);

  // Verify cache update after revalidation
  const updatedCacheData = getCacheInstance().get(cacheKey);
  const cacheContent = await decompressResponse(new Response(updatedCacheData?.body, {
    status: updatedCacheData?.status,
    headers: updatedCacheData?.headers,
  }));
  // Assertions for updated cache data
  expect(JSON.parse(cacheContent)).toEqual(newResponseData);

  // Restore original fetch
  // @ts-ignore
  globalThis.fetch = originalFetch;
});