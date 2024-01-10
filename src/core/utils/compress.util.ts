import os from "os";
import crypto from "crypto";
import { unlinkSync } from "node:fs";

/**
 * Checks if Brotli compression is available in the system by invoking the Brotli command-line tool and parsing its version.
 *
 * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether Brotli compression is supported (true if Brotli version is 1 or higher).
 */
export const canUseBrotli = await (async () => {
	try {
		const proc = Bun.spawn(["brotli", "--version"]);
		const output = await new Response(proc.stdout).text();
		const brotliVersion = parseInt(output.match(/brotli\s+(.*)/)?.[1] || "");
		return brotliVersion >= 1;
	} catch (ex) {
		console.log("Error: while getting brotli version", ex);
	}
	return false;
})();

/**
 * Compresses data using the Brotli algorithm via the brotli command-line tool. This function is necessary because Brotli compression is not natively supported in Bun yet.
 *
 * @param {string | Uint8Array} rawData - The data to compress, either as a string or Uint8Array.
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed data as a Uint8Array.
 */
export async function brotliCompress(
	rawData: string | Uint8Array,
): Promise<Uint8Array> {
	// Generate a unique filename in the OS's temporary directory
	const tempFile = `${os.tmpdir()}/brotli_temp_${crypto
		.randomBytes(8)
		.toString("hex")}.txt`;
	await Bun.write(tempFile, rawData);

	const brotli = Bun.spawn(["brotli", "-c", "-q", "11", tempFile]);

	// Collect compressed data chunks
	const chunks = [];
	for await (const chunk of brotli.stdout) {
		chunks.push(chunk);
	}

	// Concatenate chunks into a single Uint8Array
	const combinedLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const result = new Uint8Array(combinedLength);

	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	// Clean up the temporary file
	unlinkSync(tempFile);

	return result;
}

/**
 * Decompresses data using the Brotli algorithm via the brotli command-line tool. Assumes that the brotli CLI tool is installed and accessible in the system.
 *
 * @param {string | Uint8Array} rawCompressedData - The compressed data to decompress, either as a string or Uint8Array.
 * @returns {Promise<string>} A promise that resolves to the decompressed data as a string.
 */
export async function brotliDecompress(
	rawCompressedData: string | Uint8Array | ArrayBuffer,
): Promise<string> {
	const compressedData =
		typeof rawCompressedData === "string"
			? Buffer.from(rawCompressedData)
			: rawCompressedData;
	// Generate a unique filename in the OS's temporary directory for the compressed data
	const tempCompressedFile = `${os.tmpdir()}/brotli_compressed_temp_${crypto
		.randomBytes(8)
		.toString("hex")}.br`;
	await Bun.write(tempCompressedFile, compressedData);

	// Decompress the file
	const brotli = Bun.spawn(["brotli", "-d", "-v", "-c", tempCompressedFile]);

	// Collect decompressed data chunks
	const chunks: Buffer[] = [];
	for await (const chunk of brotli.stdout) {
		chunks.push(Buffer.from(chunk));
	}

	// Concatenate chunks into a single string
	const decompressedData = Buffer.concat(chunks).toString();

	// Clean up the temporary compressed file
	unlinkSync(tempCompressedFile);

	return decompressedData;
}

/**
 * Compresses data using Gzip compression provided by Bun.
 *
 * @param {string | Uint8Array} rawData - The data to compress, either as a string or Uint8Array.
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed data as a Uint8Array.
 */
export async function gzipCompress(
	rawData: string | Uint8Array,
): Promise<Uint8Array> {
	const dataArr =
		typeof rawData === "string"
			? new Uint8Array(Buffer.from(rawData))
			: rawData;
	return Bun.gzipSync(dataArr, {
		level: 9,
		memLevel: 9,
	});
}

/**
 * Decompresses Gzip compressed data using Bun's decompression utility.
 *
 * @param {string | Uint8Array} rawData - The compressed data to decompress, either as a string or Uint8Array.
 * @returns {Promise<string>} A promise that resolves to the decompressed data as a string.
 */
export async function gzipDecompress(
	rawData: string | Uint8Array,
): Promise<string> {
	const data =
		typeof rawData === "string"
			? new Uint8Array(Buffer.from(rawData))
			: rawData;
	const decompressed = Bun.gunzipSync(data);
	try {
		// Assuming the original data was a UTF-8 encoded string
		return new TextDecoder("utf-8").decode(decompressed);
	} catch (e) {
		console.error("Decompression failed: ", e);
		throw e; // Rethrow the error to handle it outside this function if necessary
	}
}

/**
 * Compresses data using Deflate compression provided by Bun.
 *
 * @param {string | Uint8Array} rawData - The data to compress, either as a string or Uint8Array.
 * @returns {Promise<Uint8Array>} A promise that resolves to the compressed data as a Uint8Array.
 */
export async function deflateCompress(
	rawData: string | Uint8Array,
): Promise<Uint8Array> {
	const dataArr =
		typeof rawData === "string"
			? new Uint8Array(Buffer.from(rawData))
			: rawData;
	return Bun.deflateSync(dataArr, {
		level: 9,
		memLevel: 9,
	});
}

/**
 * Decompresses data that was compressed using the Deflate algorithm, using Bun's decompression utility.
 *
 * @param {Uint8Array} data - The compressed data to decompress.
 * @returns {Promise<string>} A promise that resolves to the decompressed data as a string.
 */
export async function deflateDecompress(data: Uint8Array): Promise<string> {
	const decompressed = Bun.inflateSync(data);
	try {
		// Assuming the original data was a UTF-8 encoded string
		return new TextDecoder("utf-8").decode(decompressed);
	} catch (e) {
		console.error("Decompression failed: ", e);
		throw e; // Rethrow the error to handle it outside this function if necessary
	}
}
