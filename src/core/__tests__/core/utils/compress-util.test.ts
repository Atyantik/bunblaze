import { test, expect } from "bun:test";
import {
	canUseBrotli,
	brotliCompress,
	brotliDecompress,
	gzipCompress,
	gzipDecompress,
	deflateCompress,
	deflateDecompress,
} from "../../../utils/compress.util";

// Sample data for testing
const sampleData = "Hello World!";

// canUseBrotli
test("canUseBrotli returns a boolean", async () => {
	const result = canUseBrotli;
	expect(typeof result).toBe("boolean");
});

// brotliCompress & brotliDecompress
test("brotliCompress and brotliDecompress", async () => {
	if (canUseBrotli) {
		const compressed = await brotliCompress(sampleData);
		expect(compressed instanceof Uint8Array).toBe(true);

		const decompressed = await brotliDecompress(compressed);
		expect(decompressed).toBe(sampleData);
	} else {
		console.log("Brotli not available, skipping test.");
	}
});

// gzipCompress & gzipDecompress
test("gzipCompress and gzipDecompress", async () => {
	const compressed = await gzipCompress(sampleData);
	expect(compressed instanceof Uint8Array).toBe(true);

	const decompressed = await gzipDecompress(compressed);
	expect(decompressed).toBe(sampleData);
});

// deflateCompress & deflateDecompress
test("deflateCompress and deflateDecompress", async () => {
	const compressed = await deflateCompress(sampleData);
	expect(compressed instanceof Uint8Array).toBe(true);

	const decompressed = await deflateDecompress(compressed);
	expect(decompressed).toBe(sampleData);
});

// Error Handling Tests

// brotliCompress & brotliDecompress
test("brotliCompress handles invalid input", async () => {
	if (canUseBrotli) {
		// @ts-ignore
		expect(brotliCompress(null)).rejects.toThrow();
		// @ts-ignore
		expect(brotliCompress(undefined)).rejects.toThrow();
		// Add more invalid input scenarios as needed
	} else {
		console.log("Brotli not available, skipping test.");
	}
});

test("brotliDecompress handles invalid input", async () => {
	if (canUseBrotli) {
		// @ts-ignore
		expect(brotliDecompress(null)).rejects.toThrow();
		// @ts-ignore
		expect(brotliDecompress(undefined)).rejects.toThrow();
		// Add more invalid input scenarios as needed
	} else {
		console.log("Brotli not available, skipping test.");
	}
});

// gzipCompress & gzipDecompress
test("gzipCompress handles invalid input", async () => {
	// @ts-ignore
	expect(gzipCompress(null)).rejects.toThrow();
	// @ts-ignore
	expect(gzipCompress(undefined)).rejects.toThrow();
	// Add more invalid input scenarios as needed
});

test("gzipDecompress handles invalid input", async () => {
	// @ts-ignore
	expect(gzipDecompress(null)).rejects.toThrow();
	// @ts-ignore
	expect(gzipDecompress(undefined)).rejects.toThrow();
	// Add more invalid input scenarios as needed
});

// deflateCompress & deflateDecompress
test("deflateCompress handles invalid input", async () => {
	// @ts-ignore
	expect(deflateCompress(null)).rejects.toThrow();
	// @ts-ignore
	expect(deflateCompress(undefined)).rejects.toThrow();
	// Add more invalid input scenarios as needed
});

test("deflateDecompress handles invalid input", async () => {
	// @ts-ignore
	expect(deflateDecompress(null)).rejects.toThrow();
	// @ts-ignore
	expect(deflateDecompress(undefined)).rejects.toThrow();
	// Add more invalid input scenarios as needed
});
