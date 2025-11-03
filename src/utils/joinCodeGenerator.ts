/**
 * Generates a random 6-character alphanumeric join code
 * Format: ABC123 (uppercase letters and numbers)
 */
export const generateJoinCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Validates if a code matches the expected format (6 alphanumeric chars)
 */
export const isValidJoinCode = (code: string): boolean => {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
};

