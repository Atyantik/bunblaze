/**
 * Creates a memoized version of a function that depends on a Request object. It uses a WeakMap to cache the results
 * based on the Request object to avoid memory leaks. This is particularly useful for caching results of operations
 * that are expensive and request-specific.
 *
 * @param {F} fn - The function to be memoized. It should accept a Request object as its first argument.
 * @returns {F} The memoized function.
 * @template F - A function type that takes a Request and any number of additional arguments.
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function requestMemoize<F extends (req: Request, ...args: any[]) => any>(
	fn: F,
): F {
	const cache = new WeakMap<Request, ReturnType<F>>();

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return function (this: any, req: Request, ...args: any[]): ReturnType<F> {
		// Check if the cache has a result for this request
		if (cache.has(req)) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return cache.get(req)!;
		}

		// Call the function and store the result in the cache
		const result = fn.apply(this, [req, ...args]);
		cache.set(req, result);
		return result;
	} as F;
}

/**
 * Creates a memoized version of a function with a reference object as a cache key. It uses a WeakMap associated with
 * the reference object to store function results. This approach is useful when memoization needs to be tied to the
 * lifecycle of a particular object, preventing memory leaks.
 *
 * @param {F} fn - The function to be memoized.
 * @param {{ current: any }} ref - A reference object used as the key for caching.
 * @returns {F} The memoized function.
 * @template F - A function type that takes any number of arguments.
 */
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function memoizeByRef<F extends (...args: any[]) => any>(
	fn: F,
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	ref: { current: any },
): F {
	
	const objCache = new WeakMap();

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return function (this: any, ...args: any[]): ReturnType<F> {
		if (!objCache.has(ref.current)) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			objCache.set(ref.current, new Map<any, ReturnType<F>>());
		}
		const cache = objCache.get(ref.current);
		
		const key = JSON.stringify(args);
		// Check if the cache has a result for this request
		if (cache.has(key)) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			return cache.get(key)!;
		}

		// Call the function and store the result in the cache
		const result = fn.apply(this, [...args]);
		cache.set(key, result);
		return result;
	} as F;
}
