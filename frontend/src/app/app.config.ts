import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { routes } from './app.routes';

const portalTheme = definePreset(Aura, {
  components: {
    inputtext: {
      root: {
        borderColor: '#929292',
        placeholderColor: '#656565',
        invalidPlaceholderColor: '#656565',
        hoverBorderColor: '#272727',
        focusBorderColor: '#a92e28',
        invalidBorderColor: '#a92e28',
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    providePrimeNG({ theme: { preset: portalTheme, options: { darkModeSelector: false } } }),
  ]
};
