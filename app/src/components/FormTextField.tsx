import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import type { TextInputProps } from 'react-native';

import { translateError } from '@/lib/errors';

import { TextField } from './TextField';

type Props<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
};

export function FormTextField<T extends FieldValues>({ control, name, label, ...input }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={translateError(fieldState.error?.message)}
          {...input}
        />
      )}
    />
  );
}
