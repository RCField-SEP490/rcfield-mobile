import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useAuthStore } from '@/shared/store/auth-store';

type WsCallback = (event: string, data: any) => void;

const AUTH_CLOSE_CODES = new Set([4001, 4003, 4401, 4403]);

function isAuthClose(code: number, reason: string) {
  const normalizedReason = reason.toLowerCase();
  return (
    AUTH_CLOSE_CODES.has(code) ||
    normalizedReason.includes('invalid token') ||
    normalizedReason.includes('unauthorized') ||
    normalizedReason.includes('forbidden')
  );
}

function toWebSocketUrl(apiUrl: string, accessToken: string) {
  try {
    const urlObj = new URL(apiUrl);
    const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${urlObj.host}/ws?token=${encodeURIComponent(accessToken)}`;
  } catch {
    const match = apiUrl.match(/^(https?):\/\/([^/]+)/);
    if (match) {
      const protocol = match[1] === 'https' ? 'wss' : 'ws';
      return `${protocol}://${match[2]}/ws?token=${encodeURIComponent(accessToken)}`;
    }

    return `ws://192.168.1.4:3000/ws?token=${encodeURIComponent(accessToken)}`;
  }
}

function redactToken(url: string, accessToken: string) {
  return url.replace(encodeURIComponent(accessToken), '[token]');
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsCallback>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private connectedToken: string | null = null;
  private rejectedToken: string | null = null;
  private intentionalDisconnect = false;

  public connect() {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      this.disconnect();
      return;
    }

    if (this.rejectedToken === accessToken) {
      console.warn('[WS] Token was rejected by the server. Waiting for a new token before reconnecting.');
      return;
    }

    if (this.ws || this.isConnecting) {
      if (this.connectedToken === accessToken || this.isConnecting) {
        return;
      }

      this.disconnect();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.intentionalDisconnect = false;
    this.isConnecting = true;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.4:3000/api/v1';
    const wsUrl = toWebSocketUrl(apiUrl, accessToken);

    console.log('[WS] Connecting to:', redactToken(wsUrl, accessToken));

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        console.log('[WS] Connection established');
        this.connectedToken = accessToken;
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      socket.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data } = payload;
          console.log('[WS] Received event:', event, data);

          this.handleInAppNotification(event, data);
          this.listeners.forEach((callback) => callback(event, data));
        } catch (err) {
          console.error('[WS] Failed to parse message data:', err);
        }
      };

      socket.onerror = (error) => {
        console.error('[WS] Socket error:', error);
      };

      socket.onclose = (e) => {
        if (this.ws !== socket) {
          return;
        }

        console.log('[WS] Socket closed:', e.code, e.reason);
        const wasIntentional = this.intentionalDisconnect;
        this.ws = null;
        this.connectedToken = null;
        this.isConnecting = false;
        this.intentionalDisconnect = false;

        if (wasIntentional) {
          return;
        }

        if (isAuthClose(e.code, e.reason)) {
          this.rejectedToken = accessToken;
          console.warn('[WS] Authentication rejected. Reconnect stopped until the access token changes.');
          return;
        }

        this.scheduleReconnect(accessToken);
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this.isConnecting = false;
      this.scheduleReconnect(accessToken);
    }
  }

  private handleInAppNotification(event: string, data: any) {
    switch (event) {
      case 'SESSION_CHECKIN_INSPECTION':
        Alert.alert(
          'Bien ban ban giao xe',
          'Nhan vien truc ca vua ban giao xe va bat dau phien choi cua ban. Luot choi hien da co hieu luc!'
        );
        break;
      case 'SESSION_CHECKOUT_INSPECTION':
        Alert.alert(
          'Bien ban tra xe',
          'Nhan vien truc ca vua thuc hien kiem tra va nhan lai xe. Vui long kiem tra va xac nhan bien ban.',
          [
            {
              text: 'Kiem tra ngay',
              onPress: () => {
                if (data?.sessionId) {
                  router.push({
                    pathname: '/customer/inspections/[sessionId]',
                    params: { sessionId: data.sessionId, inspectionId: data.inspectionId },
                  } as any);
                }
              },
            },
            { text: 'De sau', style: 'cancel' },
          ]
        );
        break;
      case 'CUSTOMER_PAYMENT_CONFIRMED':
        Alert.alert(
          'Thanh toan thanh cong',
          'Da nhan duoc khoan thanh toan hoa don / phi phat sinh cho don dat san cua ban.'
        );
        break;
      case 'SESSION_EXTENSION_PROPOSED':
        Alert.alert(
          'Yeu cau gia han ca choi',
          `Nhan vien vua de xuat gia han ca choi them ${data.extraMinutes} phut voi phi phat sinh la ${Number(data.additionalFee).toLocaleString('vi-VN')}d.`
        );
        break;
      case 'SESSION_FNB_ORDER_ADDED':
        Alert.alert(
          'Goi mon thanh cong',
          `Mon an/nuoc uong moi tri gia ${Number(data.totalAmount).toLocaleString('vi-VN')}d da duoc them thanh cong vao phong chay.`
        );
        break;
    }
  }

  private scheduleReconnect(tokenAtClose: string) {
    if (this.reconnectTimer) return;

    const currentToken = useAuthStore.getState().accessToken;
    if (!currentToken || currentToken !== tokenAtClose || this.rejectedToken === currentToken) {
      return;
    }

    console.log('[WS] Scheduling reconnection in 5 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  public subscribe(callback: WsCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnecting = false;
    this.connectedToken = null;

    if (this.ws) {
      this.intentionalDisconnect = true;
      this.ws.close();
      this.ws = null;
    } else {
      this.intentionalDisconnect = false;
    }

    console.log('[WS] Disconnected');
  }
}

export const wsClient = new WebSocketClient();
