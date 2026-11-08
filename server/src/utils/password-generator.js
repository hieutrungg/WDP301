import crypto from "node:crypto";

// Look-alike characters (0/O, 1/l/I) are left out so the password is easy to type from an email.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SPECIAL = "!@#$%^&*";
const ALL = LOWER + UPPER + DIGITS + SPECIAL;

const pick = (alphabet) => alphabet[crypto.randomInt(alphabet.length)];

/**
 * Random password that meets the account password policy (auth.validation.js strongPassword):
 * at least one lowercase, uppercase, digit and special character. Uses a CSPRNG.
 * @param {number} [length=8]
 * @returns {string}
 */
export const generatePassword = (length = 8) => {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher-Yates shuffle so the required classes are not always in the first positions.
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }
  return chars.join("");
};
