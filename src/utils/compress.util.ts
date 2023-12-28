import os from "os";
import crypto from "crypto";
import { unlinkSync } from "node:fs";

export const canUseBrotli = await (async () => {
	const proc = Bun.spawn(["brotli", "--version"]);
	const output = await new Response(proc.stdout).text();
	const brotliVersion = parseInt(output.match(/brotli\s+(.*)/)?.[1] || "");
	return brotliVersion >= 1;
})();

/**
 * Compress data with brotli-cli as brotli is not yet supported
 * by Bun at the moment. Once it is officially supported,
 * we can simplify this further
 * @param data string
 * @returns Uint8Array
 */
export async function brotliCompress(data: string): Promise<Uint8Array> {
	// Generate a unique filename in the OS's temporary directory
	const tempFile = `${os.tmpdir()}/brotli_temp_${crypto
		.randomBytes(8)
		.toString("hex")}.txt`;
	await Bun.write(tempFile, data);

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
 * Decompress data using brotli-cli. This function assumes that
 * the brotli CLI tool is installed and available in the system.
 * @param compressedData Uint8Array
 * @returns Promise<string>
 */
export async function brotliDecompress(compressedData: Uint8Array): Promise<string> {
	// Generate a unique filename in the OS's temporary directory for the compressed data
	const tempCompressedFile = `${os.tmpdir()}/brotli_compressed_temp_${crypto.randomBytes(8).toString("hex")}.br`;
	await Bun.write(tempCompressedFile, compressedData);

	// Decompress the file
	const brotli = Bun.spawn(["brotli", "-d", "-c", tempCompressedFile]);

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

export async function gzipCompress(data: string): Promise<Uint8Array> {
	const compressedDataBuffer = Buffer.from(data);
	return Bun.gzipSync(compressedDataBuffer, {
		level: 9,
		memLevel: 9,
	});
}
