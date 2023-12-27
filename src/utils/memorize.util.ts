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
