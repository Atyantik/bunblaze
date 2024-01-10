import { test, expect } from 'bun:test';
import { decode, encode } from '../../../utils/base64.util';

test('decode correctly decodes base64 string', () => {
  // Test for browser environment (using atob)
  if (typeof atob === 'function') {
    const base64String = 'SGVsbG8sIHdvcmxkIQ==';
    const decodedString = decode(base64String);
    expect(decodedString).toBe('Hello, world!');
  }
  // Test for Node.js environment (using Buffer)
  if (typeof Buffer !== 'undefined') {
    const base64String = 'SGVsbG8sIHdvcmxkIQ==';
    const decodedString = decode(base64String);
    expect(decodedString).toBe('Hello, world!');
  }
});

test('encode correctly encodes string to base64', () => {
  // Test for browser environment (using btoa)
  if (typeof btoa === 'function') {
    const inputString = 'Hello, world!';
    const encodedString = encode(inputString);
    expect(encodedString).toBe('SGVsbG8sIHdvcmxkIQ==');
  }
  // Test for Node.js environment (using Buffer)
  if (typeof Buffer !== 'undefined') {
    const inputString = 'Hello, world!';
    const encodedString = encode(inputString);
    expect(encodedString).toBe('SGVsbG8sIHdvcmxkIQ==');
  }
});