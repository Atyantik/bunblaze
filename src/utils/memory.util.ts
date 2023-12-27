import os from "os";

export async function getFreeMemoryInBytes() {
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
		console.error("Error fetching free memory:", err);
	}
	return freeMemory;
}
