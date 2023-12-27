import xxhashjs from "xxhashjs";

const DEFAULT_SEED = 0xfdea1e3;

export const hash = (string: string) => {
	const h64 = xxhashjs.h64(string, DEFAULT_SEED);
	return h64.toString(16);
};
