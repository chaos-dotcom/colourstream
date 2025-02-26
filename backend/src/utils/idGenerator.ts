/**
 * Generates a unique ID for use in room identifiers
 * @returns A unique string ID
 */
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 