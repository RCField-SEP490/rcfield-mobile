import { useAuthStore } from '@/shared/store/auth-store';
import { Alert } from 'react-native';

type WsCallback = (event: string, data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<WsCallback>();
  private reconnectTimer: any = null;
  private isConnecting = false;

  public connect() {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) {
      this.disconnect();
      return;
    }

    if (this.ws || this.isConnecting) return;

    this.isConnecting = true;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.4:3000/api/v1';
    
    // Convert API HTTP URL to WS URL
    let wsUrl = '';
    try {
      const urlObj = new URL(apiUrl);
      const protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
      // wsService in backend is mounted at path: '/ws'
      wsUrl = `${protocol}//${urlObj.host}/ws?token=${accessToken}`;
    } catch {
      // Fallback regex if URL parse fails
      const match = apiUrl.match(/^(https?):\/\/([^\/]+)/);
      if (match) {
        const protocol = match[1] === 'https' ? 'wss' : 'ws';
        wsUrl = `${protocol}://${match[2]}/ws?token=${accessToken}`;
      } else {
        wsUrl = `ws://192.168.1.4:3000/ws?token=${accessToken}`;
      }
    }

    console.log('[WS] Connecting to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connection established');
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { event, data } = payload;
          console.log('[WS] Received event:', event, data);

          // Handle common customer notifications and show in-app Alerts
          this.handleInAppNotification(event, data);

          // Notify all subscribers
          this.listeners.forEach((callback) => callback(event, data));
        } catch (err) {
          console.error('[WS] Failed to parse message data:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Socket error:', error);
      };

      this.ws.onclose = (e) => {
        console.log('[WS] Socket closed:', e.code, e.reason);
        this.ws = null;
        this.isConnecting = false;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleInAppNotification(event: string, data: any) {
    // Notify custom local push alert popup when app is open
    switch (event) {
      case 'SESSION_CHECKIN_INSPECTION':
        Alert.alert(
          'Biên bản bàn giao xe',
          'Nhân viên trực ca vừa bàn giao xe và bắt đầu phiên chơi của bạn. Lượt chơi hiện đã có hiệu lực!'
        );
        break;
      case 'SESSION_CHECKOUT_INSPECTION':
        Alert.alert(
          'Biên bản trả xe',
          'Nhân viên trực ca vừa thực hiện kiểm tra và nhận lại xe. Phiên chơi của bạn đã kết thúc.'
        );
        break;
      case 'CUSTOMER_PAYMENT_CONFIRMED':
        Alert.alert(
          'Thanh toán thành công',
          'Đã nhận được khoản thanh toán hóa đơn / phí phát sinh cho đơn đặt sân của bạn.'
        );
        break;
      case 'SESSION_EXTENSION_PROPOSED':
        Alert.alert(
          'Yêu cầu gia hạn ca chơi',
          `Nhân viên vừa đề xuất gia hạn ca chơi thêm ${data.extraMinutes} phút với phí phát sinh là ${Number(data.additionalFee).toLocaleString('vi-VN')}đ.`
        );
        break;
      case 'SESSION_FNB_ORDER_ADDED':
        Alert.alert(
          'Gọi món thành công',
          `Món ăn/nước uống mới trị giá ${Number(data.totalAmount).toLocaleString('vi-VN')}đ đã được thêm thành công vào phòng chạy.`
        );
        break;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return; // Don't reconnect if logged out

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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    console.log('[WS] Disconnected');
  }
}

export const wsClient = new WebSocketClient();
