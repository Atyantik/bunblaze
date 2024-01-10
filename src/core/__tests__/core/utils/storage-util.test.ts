import { serializeToFile, deserializeFromFile } from '../../../utils/storage.util';
import { test, expect } from 'bun:test';
import path from "path";
import os from "os";

const filename = path.join(os.tmpdir(), "test_cache.bin");
const nonExistentFile = path.join(os.tmpdir(), "not_existing_test_cache.bin");

// Mock Data
const mockDataArray: DataArray[] = [
    [
        "requestId1",
        {
            value: {
                body: new Uint8Array(Buffer.from("body1", "utf-8")),
                status: 200,
                headers: [["Content-Type", "text/plain"]]
            },
            size: 100 // Mock size
        }
    ],
    // ... add more mock data items
];

// Test serializeToFile
test("serializeToFile writes data correctly", async () => {
  await serializeToFile(mockDataArray, filename);

  // Verify file existence
  const fileExists = await Bun.file(filename).exists();
  expect(fileExists).toBe(true);

  // Optionally, verify file content (detailed verification)
  // ... additional checks can be added here
});

// Test deserializeFromFile
test("deserializeFromFile reads data correctly", async () => {
  const deserializedData = await deserializeFromFile(filename);

  // Verify that deserializedData matches the original mockDataArray
  expect(deserializedData.length).toBe(mockDataArray.length);
  // ... add more detailed checks for each field
});

// Error Handling for serializeToFile
test("serializeToFile handles errors", async () => {
  // @ts-ignore
  expect(serializeToFile(null, filename)).rejects.toThrow();
  // @ts-ignore
  expect(serializeToFile(mockDataArray, null)).rejects.toThrow();
  // Add more error handling scenarios as needed
});

// Error Handling for deserializeFromFile
test("deserializeFromFile handles errors", async () => {
  console.log('nonExistentFile', nonExistentFile);
  expect(deserializeFromFile(nonExistentFile)).rejects.toThrow();
  // Add more error handling scenarios as needed
});