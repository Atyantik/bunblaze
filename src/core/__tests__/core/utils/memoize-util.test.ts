import { test, expect, mock } from "bun:test";
import {
	requestMemoize,
	memoizeByRef,
} from "../../../utils/memoize.util";

test("requestMemoize returns correct results and caches them", () => {
	const mockFunction = mock((_, arg) => arg);
	const memoized = requestMemoize(mockFunction);

	const request1 = new Request("http://example.com");
	const request2 = new Request("http://example.com");

	expect(memoized(request1, "test")).toBe("test");
	expect(memoized(request1, "test")).toBe("test");
	expect(mockFunction).toHaveBeenCalledTimes(1); // Function should be called only once for the same request

	expect(memoized(request2, "test")).toBe("test");
	expect(mockFunction).toHaveBeenCalledTimes(2); // Function should be called again for a different request
});

test("memoizeByRef returns correct results and caches them", () => {
	const mockFunction = mock((arg) => arg);
	const ref = { current: {} };
	const memoized = memoizeByRef(mockFunction, ref);

	expect(memoized("test")).toBe("test");
	expect(memoized("test")).toBe("test");
	expect(mockFunction).toHaveBeenCalledTimes(1); // Function should be called only once for the same arguments

	ref.current = {}; // Changing reference
	expect(memoized("test")).toBe("test");
	expect(mockFunction).toHaveBeenCalledTimes(2); // Function should be called again as the reference changed

	expect(memoized("other")).toBe("other");
	expect(mockFunction).toHaveBeenCalledTimes(3); // Function should be called again for different arguments
});
