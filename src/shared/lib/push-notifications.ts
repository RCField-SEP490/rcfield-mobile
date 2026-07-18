import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/shared/lib/api';
import { env } from '@/shared/config/env';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;
let responseSubscription: ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null = null;
let handledInitialNotificationId: string | null = null;

function getProjectId() {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string }; projectId?: string }
    | undefined;

  return (
    Constants.easConfig?.projectId ||
    extra?.eas?.projectId ||
    extra?.projectId ||
    env.easProjectId ||
    ''
  );
}

export function getRouteFromNotificationData(data: Record<string, unknown>) {
  if (typeof data.route === 'string' && data.route.length > 0) {
    return data.route;
  }

  const type = String(data.type || '');
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
  const inspectionId = typeof data.inspectionId === 'string' ? data.inspectionId : '';
  const bookingId = typeof data.bookingId === 'string' ? data.bookingId : '';

  if (
    (type === 'SESSION_CHECKIN_INSPECTION' || type === 'SESSION_CHECKOUT_INSPECTION') &&
    sessionId
  ) {
    return inspectionId
      ? `/customer/inspections/${sessionId}?inspectionId=${inspectionId}`
      : `/customer/inspections/${sessionId}`;
  }

  if (type === 'SESSION_EXTENSION_PROPOSED' && sessionId) {
    return `/customer/extension/${sessionId}`;
  }

  if (type === 'BOOKING_REVIEW_REQUEST' && bookingId) {
    return `/customer/review/${bookingId}`;
  }

  if (type === 'CUSTOMER_PAYMENT_CONFIRMED' && bookingId) {
    return `/booking/${bookingId}`;
  }

  if (type === 'SESSION_FNB_ORDER_ADDED' && bookingId) {
    return `/booking/${bookingId}`;
  }

  if (
    [
      'CUSTOMER_CHECKIN_CONFIRMED',
      'CUSTOMER_CHECKOUT_CONFIRMED',
      'CUSTOMER_INSPECTION_DISPUTED',
      'CUSTOMER_EXTENSION_APPROVED',
      'CUSTOMER_EXTENSION_REJECTED',
    ].includes(type) &&
    sessionId
  ) {
    return `/staff/session/${sessionId}`;
  }

  return '';
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const notificationId = response.notification.request.identifier;
  if (notificationId && handledInitialNotificationId === notificationId) return;
  handledInitialNotificationId = notificationId;

  const data = response.notification.request.content.data as Record<string, unknown>;
  const route = getRouteFromNotificationData(data);
  if (!route) return;

  setTimeout(() => {
    router.navigate(route as any);
  }, 0);
}

async function configureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'RCField',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f97316',
  });
}

async function getNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function registerPushNotificationsAsync() {
  await configureAndroidChannel();

  const granted = await getNotificationPermission();
  if (!granted) {
    console.warn('[Push] Notification permission was not granted.');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[Push] Missing EAS project id. Set EXPO_PUBLIC_EAS_PROJECT_ID or app.json extra.eas.projectId.');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  try {
    await api.post('/provider/notifications/push-tokens', {
      token,
      platform: Platform.OS,
      device_name: Constants.deviceName ?? null,
      app_version: Constants.expoConfig?.version ?? null,
    });
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.log('[Push] Backend does not support push tokens registration yet (404). Skipping...');
    } else {
      throw err;
    }
  }

  registeredToken = token;
  return token;
}

export async function unregisterCurrentPushTokenAsync() {
  if (!registeredToken) return;

  const token = registeredToken;
  registeredToken = null;
  try {
    await api.delete('/provider/notifications/push-tokens', { data: { token } });
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.log('[Push] Backend does not support push tokens unregistration yet (404). Skipping...');
    } else {
      throw err;
    }
  }
}

export function startNotificationResponseListener() {
  if (!responseSubscription) {
    responseSubscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
  }

  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) {
    handleNotificationResponse(lastResponse);
  }

  return () => {
    responseSubscription?.remove();
    responseSubscription = null;
  };
}
