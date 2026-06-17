export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
};

if (!env.apiUrl) {
  console.warn('Missing EXPO_PUBLIC_API_URL configuration. Please set it in your local .env file.');
}
