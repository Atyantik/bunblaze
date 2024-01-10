import { getFreeMemoryInBytes } from "../../../utils/memory.util.ts";
import os from "os";
import { test, expect, mock, beforeEach, afterEach } from "bun:test";

// Backup the original functions
let originalPlatform: typeof os.platform;
let originalSpawn: typeof Bun.spawn;

beforeEach(() => {
	originalPlatform = os.platform;
	originalSpawn = Bun.spawn;
});

afterEach(() => {
	os.platform = originalPlatform;
	Bun.spawn = originalSpawn;
});

function mockPlatform(platform: NodeJS.Platform) {
	os.platform = () => platform;
}

function mockSpawn(response: string) {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	Bun.spawn = (): any => ({
        stdout: new ReadableStream({
            start(controller) {
                controller.enqueue(response);
                controller.close();
            },
        }),
        // Include other required properties here
    });
}

test("getFreeMemoryInBytes - macOS", async () => {
    mockPlatform('darwin');
    mockSpawn("page size of 4096 bytes\nPages free: 1000.\n");

    const freeMemory = await getFreeMemoryInBytes();
    expect(freeMemory).toBe(4096 * 1000); // 4MB * 1000 pages
});

test("getFreeMemoryInBytes - Linux", async () => {
    mockPlatform('linux');
    mockSpawn("              total        used        free      shared  buff/cache   available\nMem:     1000000    200000     800000  331669504 5113874176 10650030080\n");

    const freeMemory = await getFreeMemoryInBytes();
    expect(freeMemory).toBe(800000); // Free memory from 'free -b' output
});

test("getFreeMemoryInBytes - Windows", async () => {
    mockPlatform('win32');
    mockSpawn("FreePhysicalMemory=800000\n");

    const freeMemory = await getFreeMemoryInBytes();
    expect(freeMemory).toBe(800000 * 1024); // Convert KB to Bytes
});

test("getFreeMemoryInBytes - Unsupported platform", async () => {
    mockPlatform('unsupported' as NodeJS.Platform);

    await expect(getFreeMemoryInBytes()).rejects.toThrow("Unsupported platform");
});