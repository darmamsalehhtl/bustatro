const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_PATTERN.test(username);
}

// The validate* functions return an error message, or null when the input is valid.

export function validateCredentials({ username, password } = {}, { isRegistration = false } = {}) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return 'Username and password required';
  }
  if (!isValidUsername(username)) {
    return 'Username must be 3-20 characters: letters, digits, _ or -';
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters`;
  }
  if (isRegistration && password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (password.length === 0) {
    return 'Username and password required';
  }
  return null;
}

export function validateState(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return 'State must be an object';
  }
  return null;
}
