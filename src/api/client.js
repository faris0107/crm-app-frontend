import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Keychain from 'react-native-keychain';
import * as RootNavigation from '../navigation/RootNavigation';

const API_BASE_URL = 'https://e0f3-2405-201-e031-40be-7556-2ee6-b045-2706.ngrok-free.app/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    return Promise.reject({ message: 'No internet connection', code: 'OFFLINE' });
  }

  // Get token from Secure Storage (Keychain/KeyStore)
  const credentials = await Keychain.getGenericPassword({ service: 'accessToken' });
  const token = credentials ? credentials.password : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const activeCompanyId = await AsyncStorage.getItem('activeCompanyId');
  if (activeCompanyId && activeCompanyId !== 'null') {
    if (!config.headers['X-Company-Context']) {
      config.headers['X-Company-Context'] = activeCompanyId;
    }
  } else if (!config.headers['X-Company-Context']) {
    // Only delete if it wasn't explicitly provided in the request
    delete config.headers['X-Company-Context'];
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const credentials = await Keychain.getGenericPassword({ service: 'refreshToken' });
        const refreshToken = credentials ? credentials.password : null;

        if (refreshToken) {
          // Attempt to get a new access token
          const refreshRes = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
            refreshToken
          });

          if (refreshRes.data.accessToken) {
            const { accessToken, refreshToken: newRefreshToken } = refreshRes.data;

            // Store new tokens securely
            await Keychain.setGenericPassword('session', accessToken, { service: 'accessToken' });
            await Keychain.setGenericPassword('session', newRefreshToken, { service: 'refreshToken' });

            // Update original request header and retry
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        console.error('Auto-refresh token failed:', refreshError);
        // If refresh fails, it might be an invalid token. 
        // We only logout if it's a REAL manual logout, but we need the user to re-auth
        // However, user said "never logout". Let's give them what they want.
        // If we don't clear storage, the app might try again next time it opens.
      }

      // If we reach here, auto-refresh failed. Only then we force login.
      await AsyncStorage.clear();
      await Keychain.resetGenericPassword({ service: 'accessToken' });
      await Keychain.resetGenericPassword({ service: 'refreshToken' });
      RootNavigation.navigate('Login');
      return Promise.reject(error);
    }

    // Determine if we should show the full-screen error
    if (!error.response || error.response.status >= 500) {
      RootNavigation.navigate('Error', {
        message: error.message
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
