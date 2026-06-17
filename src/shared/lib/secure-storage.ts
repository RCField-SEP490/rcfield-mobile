import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from '@/shared/constants';

export const secureTokenStorage = {
  getAccessToken() {
    return SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
  },
  setAccessToken(token: string) {
    return SecureStore.setItemAsync(STORAGE_KEYS.accessToken, token);
  },
  deleteAccessToken() {
    return SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken);
  },
  getRefreshToken() {
    return SecureStore.getItemAsync(STORAGE_KEYS.refreshToken);
  },
  setRefreshToken(token: string) {
    return SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, token);
  },
  deleteRefreshToken() {
    return SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken);
  },
  async clearTokens() {
    await Promise.all([this.deleteAccessToken(), this.deleteRefreshToken()]);
  },
  async getTokenPair() {
    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);

    return { accessToken, refreshToken };
  },
  async setTokenPair(accessToken: string, refreshToken: string) {
    await Promise.all([this.setAccessToken(accessToken), this.setRefreshToken(refreshToken)]);
  },
};
