'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Pembalut nipis di atas `next-themes` supaya susun atur akar (komponen
 * pelayan) boleh membekalkan konfigurasi tema tanpa menjadi komponen klien.
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>
) {
  return <NextThemesProvider {...props} />;
}
