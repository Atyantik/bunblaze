/**
 * Compares the current version of Bun with a specified required version.
 * 
 * This function takes a `requiredVersion` string as an argument and compares it against
 * the current Bun version obtained from `Bun.version`. It splits both versions into
 * their constituent parts (major, minor, patch) and compares them sequentially.
 * 
 * @param {string} requiredVersion - The version string to compare against the current Bun version.
 * It should be in the format 'major.minor.patch' (e.g., '1.0.22').
 * 
 * @returns {boolean} - Returns `true` if the current Bun version is greater than or equal to
 * the `requiredVersion`, otherwise returns `false`. If the versions are exactly equal,
 * it also returns `true`.
 * 
 * @example
 * // Suppose the current Bun version is 1.0.23
 * console.log(isVersionGreaterOrEqual("1.0.22")); // Output: true
 * console.log(isVersionGreaterOrEqual("1.1.0"));  // Output: false
 */
export function isBunVersionGreaterOrEqual(requiredVersion: string): boolean {
  const currentVersion = Bun.version;
  const currentParts = currentVersion.split('.').map(Number);
  const requiredParts = requiredVersion.split('.').map(Number);

  for (let i = 0; i < requiredParts.length; i++) {
      if (currentParts[i] > requiredParts[i]) return true;
      if (currentParts[i] < requiredParts[i]) return false;
  }
  
  return true; // Versions are equal
}
