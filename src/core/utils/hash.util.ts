import xxhashjs from "xxhashjs";

const DEFAULT_SEED = 0xfdea1e3;

/**
 * Generates a hash for a given string using the xxHash algorithm. 
 * This function utilizes xxhashjs to create a 64-bit hash of the string.
 *
 * @param {string} string - The string to be hashed.
 * @returns {string} The resulting hash as a hexadecimal string.
 */
export const hash = (string: string) => {
	const h64 = xxhashjs.h64(string, DEFAULT_SEED);
	return h64.toString(16);
};
