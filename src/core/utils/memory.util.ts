import os from "os";

/**
 * Asynchronously retrieves the amount of free memory in bytes on the system. This function supports multiple platforms,
 * including macOS, Linux, and Windows, by executing platform-specific commands to determine free memory.
 * If the platform is not supported or an error occurs, it defaults to returning 2 GB of free memory.
 *
 * @returns {Promise<number>} A promise that resolves to the number of free memory bytes available on the system.
 * @throws {Error} Throws an error if the platform is not supported.
 */
export async function getFreeMemoryInBytes(): Promise<number> {
	const platform = os.platform();

	let freeMemory = 2 * 1024 * 1024 * 1024; // 2 GB
	try {
		if (platform === "darwin") {
			// macOS
			const proc = Bun.spawn(["vm_stat"]);
			const output = await new Response(proc.stdout).text();
			// @ts-ignore
			const pageSize = parseInt(output.match(/page size of\s+(\d+) bytes/)[1]);
			// @ts-ignore
			const freePages = parseInt(output.match(/Pages free:\s+(\d+)\./)[1]);
			freeMemory = pageSize * freePages;
		} else if (platform === "linux") {
			// Linux
			const proc = Bun.spawn(["free", "-b"]);
			const output = await new Response(proc.stdout).text();
			const lines = output.split("\n");
			const memoryInfo = lines[1].split(/\s+/);
			freeMemory = parseInt(memoryInfo[3]);
		} else if (platform === "win32") {
			// Windows
			const proc = Bun.spawn([
				"wmic",
				"OS",
				"get",
				"FreePhysicalMemory",
				"/Value",
			]);
			const output = await new Response(proc.stdout).text();
			const freeMemoryKB = parseInt(
				// @ts-ignore
				output.match(/FreePhysicalMemory=(\d+)/)[1],
			);
			freeMemory = freeMemoryKB * 1024;
		} else {
			throw new Error("Unsupported platform");
		}
	} catch (err) {
		if (err instanceof Error && err.message === "Unsupported platform") {
			throw err;
		}
		console.error("Error fetching free memory:", err);
	}
	return freeMemory;
}
