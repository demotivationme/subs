import { errorMessage } from '@/lib/errors';

import { AppText } from './AppText';

export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <AppText variant="error" accessibilityRole="alert">
      {errorMessage(error)}
    </AppText>
  );
}
