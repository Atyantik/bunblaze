/**
 * Decodes a base64 encoded string. This function checks the environment
 * to determine the appropriate decoding mechanism.
 * It uses the `Buffer` class.
 *
 * @param {string} str - The base64 encoded string to be decoded.
 * @returns {string} The decoded string.
 */
export const decode = (str: string): string => {
  return Buffer.from(str, "base64").toString()
};

/**
 * Encodes a string into base64 format. This function checks the environment to determine the appropriate encoding mechanism. 
 * It uses the `Buffer` class.
 *
 * @param {string} str - The string to be encoded into base64.
 * @returns {string} The base64 encoded string.
 */
export const encode = (str: string): string => {
	return Buffer.from(str).toString("base64");
};
