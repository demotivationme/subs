import { ApiError, NetworkError } from '@/api/errors';

import { applyServerErrors } from './forms';

type Values = { email: string; serviceName: string };

test('puts 422 messages under matching or mapped fields', () => {
  const setError = jest.fn();
  const error = new ApiError(422, 'x', { email: ['Taken.'], service_name: ['Too long.'] });

  const handled = applyServerErrors<Values>(error, setError, ['email'], { service_name: 'serviceName' });

  expect(handled).toBe(true);
  expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Taken.' });
  expect(setError).toHaveBeenCalledWith('serviceName', { type: 'server', message: 'Too long.' });
});

test('reports unhandled when nothing maps or it is not a 422', () => {
  const setError = jest.fn();
  expect(applyServerErrors<Values>(new ApiError(422, 'x', { timezone: ['Bad.'] }), setError, ['email'])).toBe(false);
  expect(applyServerErrors<Values>(new NetworkError(), setError, ['email'])).toBe(false);
  expect(setError).not.toHaveBeenCalled();
});
