import { ApiError, NetworkError } from '@/api/errors';

import { errorMessage, translateError } from './errors';

test('maps errors to messages people can act on', () => {
  expect(errorMessage(new NetworkError())).toBe("You're offline or the server can't be reached.");
  expect(errorMessage(new ApiError(429, 'Too Many Attempts.'))).toBe('Too many attempts. Please wait a minute and try again.');
  expect(errorMessage(new ApiError(404, 'No query results'))).toBe('Not found.');
  expect(errorMessage(new ApiError(403, 'You can track up to 10 subscriptions on the free plan.'))).toBe(
    'You can track up to 10 subscriptions on the free plan.',
  );
  expect(errorMessage(new ApiError(500, 'Server Error'))).toBe('Something went wrong. Please try again.');
  expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
});

test('translateError renders keys and passes server text through', () => {
  expect(translateError('validation.required')).toBe('This field is required.');
  expect(translateError('The email has already been taken.')).toBe('The email has already been taken.');
  expect(translateError(undefined)).toBeUndefined();
});
