import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import {
  X,
  Copy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Download,
  Share2,
} from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type BankTransferCheckout } from '../api/booking-wizard.api';

interface BankTransferModalProps {
  visible: boolean;
  bookingId: string;
  checkout: BankTransferCheckout | null;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
}

export function BankTransferModal({
  visible,
  bookingId,
  checkout,
  onClose,
  onSuccess,
}: BankTransferModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isSharingQr, setIsSharingQr] = useState(false);

  // 1. Countdown timer
  const expiresAtMs = useMemo(() => {
    if (!checkout?.expires_at) return Date.now() + 15 * 60 * 1000;
    return new Date(checkout.expires_at).getTime();
  }, [checkout?.expires_at]);

  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
  );

  useEffect(() => {
    if (!visible || !checkout) {
      setIsPaid(false);
      setRedirectCountdown(5);
      setIsCheckingStatus(false);
      setIsSavingQr(false);
      setIsSharingQr(false);
      return;
    }
    setIsPaid(false);
    setRedirectCountdown(5);
    const initialRemaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
    setRemainingSeconds(initialRemaining);

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, checkout, expiresAtMs]);

  // 2. Status Polling loop
  const checkPaymentStatus = useCallback(async (silent = false) => {
    if (!bookingId) return;
    if (!silent) setIsCheckingStatus(true);
    try {
      const data = await bookingWizardApi.getBooking(bookingId);
      if (
        data?.status === 'CONFIRMED' ||
        data?.status === 'PAYMENT_CONFIRMED' ||
        data?.status === 'CHECKED_IN' ||
        data?.status === 'IN_SESSION'
      ) {
        setIsPaid(true);
      } else if (!silent) {
        Alert.alert(
          'Đang chờ xác nhận',
          'Hệ thống chưa nhận được thông tin chuyển khoản khớp với mã đơn. Nếu bạn đã chuyển, vui lòng chờ trong giây lát rồi nhấn kiểm tra lại nhé.'
        );
      }
    } catch {
      if (!silent) {
        Alert.alert('Thông báo', 'Không thể kiểm tra trạng thái lúc này. Vui lòng thử lại.');
      }
    } finally {
      if (!silent) setIsCheckingStatus(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (!visible || !bookingId || isPaid || remainingSeconds <= 0) return;

    const pollInterval = setInterval(() => {
      checkPaymentStatus(true);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [visible, bookingId, isPaid, remainingSeconds, checkPaymentStatus]);

  // 3. Auto-redirect on Paid
  useEffect(() => {
    if (!isPaid) return;

    const countdownTimer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer);
          onSuccess(bookingId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [isPaid, bookingId, onSuccess]);

  const handleCopy = async (text: string, fieldName: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getQrFileUri = async (): Promise<string | null> => {
    if (!checkout?.qr_image_data_url) return null;
    const safeRef = (checkout.ref_code || 'vietqr').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${FileSystem.cacheDirectory}vietqr_${safeRef}_${Date.now()}.png`;

    if (checkout.qr_image_data_url.startsWith('data:image')) {
      const parts = checkout.qr_image_data_url.split(',');
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      await FileSystem.writeAsStringAsync(filename, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return filename;
    } else if (checkout.qr_image_data_url.startsWith('http')) {
      const downloadResult = await FileSystem.downloadAsync(checkout.qr_image_data_url, filename);
      return downloadResult.uri;
    }
    return null;
  };

  const handleSaveQrCode = async () => {
    if (isSavingQr) return;
    setIsSavingQr(true);
    try {
      const fileUri = await getQrFileUri();
      if (!fileUri) {
        Alert.alert('Lỗi', 'Không tìm thấy hình ảnh mã QR.');
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (permission.granted) {
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Alert.alert(
          'Đã lưu mã QR thành công! 📱',
          'Ảnh VietQR đã được lưu vào thư viện ảnh trên điện thoại của bạn.\n\nBạn hãy mở ứng dụng Ngân hàng (MB, Vietcombank, Techcombank,...) và chọn "Quét QR từ ảnh" để thanh toán nhanh chóng.'
        );
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: 'Lưu hoặc chia sẻ mã VietQR',
          });
        } else {
          Alert.alert(
            'Quyền truy cập ảnh',
            'Vui lòng cấp quyền Thư viện ảnh trong Cài đặt để ứng dụng có thể lưu ảnh QR vào máy.'
          );
        }
      }
    } catch (error) {
      console.error('Save QR error:', error);
      Alert.alert('Thông báo', 'Không thể lưu mã QR vào thư viện ảnh. Bạn có thể chụp ảnh màn hình để thay thế.');
    } finally {
      setIsSavingQr(false);
    }
  };

  const handleShareQrCode = async () => {
    if (isSharingQr) return;
    setIsSharingQr(true);
    try {
      const fileUri = await getQrFileUri();
      if (!fileUri) {
        Alert.alert('Lỗi', 'Không tìm thấy hình ảnh mã QR.');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Chia sẻ mã VietQR thanh toán',
        });
      } else {
        Alert.alert('Thông báo', 'Thiết bị không hỗ trợ tính năng chia sẻ này.');
      }
    } catch (error) {
      console.error('Share QR error:', error);
    } finally {
      setIsSharingQr(false);
    }
  };

  if (!checkout) return null;

  const isExpired = remainingSeconds <= 0 && !isPaid;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-850 bg-white dark:bg-[#0f172a]">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 items-center justify-center">
              <Building2 color="#f97316" size={16} />
            </View>
            <View>
              <Text className="text-[15px] text-slate-900 dark:text-white font-bold">
                Thanh toán Chuyển khoản
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                Quét mã VietQR 24/7
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700"
          >
            <X color="#64748b" size={18} />
          </Pressable>
        </View>

        {isPaid ? (
          /* SUCCESS STATE */
          <View className="flex-1 items-center justify-center p-6 text-center">
            <View className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-500/40 items-center justify-center mb-5">
              <CheckCircle2 color="#10b981" size={44} />
            </View>
            <Text className="text-xl text-slate-900 dark:text-white font-black text-center mb-2">
              Thanh toán thành công!
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-300 text-center leading-5 font-semibold px-4 mb-6">
              Hệ thống đã xác nhận nhận tiền thành công. Lịch đặt của bạn đã được chuyển sang trạng thái sẵn sàng.
            </Text>
            <View className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl px-5 py-3.5 mb-8 flex-row items-center gap-2.5">
              <Sparkles color="#10b981" size={18} />
              <Text className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                Tự động chuyển đến đơn sau {redirectCountdown}s...
              </Text>
            </View>
            <Pressable
              onPress={() => onSuccess(bookingId)}
              className="w-full bg-[#ea580c] active:bg-[#f97316] py-3.5 rounded-xl items-center justify-center shadow-lg shadow-orange-500/20"
            >
              <Text className="text-white text-sm font-bold uppercase tracking-wider">
                Xem chi tiết lịch đặt ngay
              </Text>
            </Pressable>
          </View>
        ) : isExpired ? (
          /* EXPIRED STATE */
          <View className="flex-1 items-center justify-center p-6">
            <View className="h-20 w-20 rounded-full bg-red-100 dark:bg-red-950/60 border-2 border-red-500/40 items-center justify-center mb-5">
              <AlertTriangle color="#ef4444" size={40} />
            </View>
            <Text className="text-xl text-slate-900 dark:text-white font-black text-center mb-2">
              Hết thời gian giữ chỗ
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400 text-center leading-5 font-semibold px-4 mb-6">
              Phiên thanh toán này đã hết hạn 15 phút. Nếu bạn đã chuyển khoản, đừng lo lắng, tiền vẫn được ghi nhận trong sổ đối soát của cơ sở.
            </Text>
            <Pressable
              onPress={onClose}
              className="w-full bg-slate-200 dark:bg-slate-800 active:bg-slate-300 py-3.5 rounded-xl items-center justify-center"
            >
              <Text className="text-slate-800 dark:text-white text-sm font-bold">
                Đóng và thử lại
              </Text>
            </Pressable>
          </View>
        ) : (
          /* ACTIVE QR CHECKOUT STATE */
          <ScrollView
            contentContainerClassName="p-5 pb-12"
            showsVerticalScrollIndicator={false}
          >
            {/* Sandbox alert if applicable */}
            {checkout.is_sandbox && (
              <View className="flex-row items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 rounded-xl px-3.5 py-2.5 mb-4">
                <ShieldCheck color="#d97706" size={16} />
                <Text className="text-[11px] text-amber-800 dark:text-amber-300 font-bold flex-1">
                  Môi trường mô phỏng (Sandbox) — Không trừ tiền thật.
                </Text>
              </View>
            )}

            {/* QR Card Container */}
            <View className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm items-center">
              {/* VietQR Badge */}
              <View className="flex-row items-center justify-between w-full mb-3">
                <View className="flex-row items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2.5 py-1 rounded-lg">
                  <Text className="text-[10px] text-blue-700 dark:text-blue-300 font-extrabold tracking-wider uppercase">
                    {checkout.is_sandbox ? 'VietQR Test' : 'VietQR 24/7'}
                  </Text>
                </View>

                {/* Live Countdown Badge */}
                <View
                  className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full border ${
                    remainingSeconds <= 180
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-200 text-red-600'
                      : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40'
                  }`}
                >
                  <Clock
                    color={remainingSeconds <= 180 ? '#ef4444' : '#f97316'}
                    size={13}
                  />
                  <Text
                    className={`text-[12px] font-mono font-bold ${
                      remainingSeconds <= 180
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-[#ea580c] dark:text-[#f97316]'
                    }`}
                  >
                    Còn {formattedCountdown}
                  </Text>
                </View>
              </View>

              {/* QR Image Box */}
              <View className="border-2 border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl bg-white my-2 shadow-inner">
                {checkout.qr_image_data_url ? (
                  <Image
                    source={{ uri: checkout.qr_image_data_url }}
                    className="w-56 h-56 rounded-lg object-contain"
                  />
                ) : (
                  <View className="w-56 h-56 items-center justify-center bg-slate-50">
                    <ActivityIndicator size="small" color="#f97316" />
                    <Text className="text-xs text-slate-400 mt-2 font-semibold">
                      Đang tải mã QR...
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Actions for QR */}
              <View className="flex-row items-center gap-2 mt-2 mb-1 w-full justify-center px-1">
                <Pressable
                  onPress={handleSaveQrCode}
                  disabled={isSavingQr || !checkout.qr_image_data_url}
                  className="flex-1 max-w-[200px] py-2 px-3 rounded-xl bg-orange-500/10 active:bg-orange-500/20 border border-orange-500/30 flex-row items-center justify-center gap-1.5"
                >
                  {isSavingQr ? (
                    <ActivityIndicator size="small" color="#ea580c" />
                  ) : (
                    <Download color="#ea580c" size={15} />
                  )}
                  <Text className="text-[12px] text-[#ea580c] font-bold">
                    {isSavingQr ? 'Đang lưu...' : 'Lưu mã QR về máy'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShareQrCode}
                  disabled={isSharingQr || !checkout.qr_image_data_url}
                  className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 border border-slate-200 dark:border-slate-700 flex-row items-center justify-center gap-1.5"
                >
                  {isSharingQr ? (
                    <ActivityIndicator size="small" color="#64748b" />
                  ) : (
                    <Share2 color="#64748b" size={15} />
                  )}
                  <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold">
                    Chia sẻ
                  </Text>
                </Pressable>
              </View>

              {/* Total Amount Big Display */}
              <View className="mt-3 items-center">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  Số tiền cần chuyển
                </Text>
                <Text className="text-[26px] text-[#ea580c] font-black tracking-tight mt-0.5">
                  {checkout.amount.toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>

            {/* Transfer Details Card with One-Tap Copy */}
            <View className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mt-4 shadow-sm">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-3">
                Thông tin chuyển khoản thủ công
              </Text>

              <View className="space-y-3">
                {/* Bank Name */}
                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Ngân hàng
                  </Text>
                  <Text className="text-xs text-slate-900 dark:text-white font-bold text-right flex-1 ml-4">
                    {checkout.bank_name}
                  </Text>
                </View>

                {/* Account Name */}
                <View className="flex-row justify-between items-center py-1 border-t border-slate-100 dark:border-slate-850">
                  <Text className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Chủ tài khoản
                  </Text>
                  <Text className="text-xs text-slate-900 dark:text-white font-bold uppercase text-right flex-1 ml-4">
                    {checkout.account_name}
                  </Text>
                </View>

                {/* Account Number with Copy */}
                <View className="flex-row justify-between items-center py-1.5 border-t border-slate-100 dark:border-slate-850">
                  <View>
                    <Text className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Số tài khoản
                    </Text>
                    <Text className="text-sm font-mono text-slate-900 dark:text-white font-black mt-0.5">
                      {checkout.account_number}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleCopy(checkout.account_number, 'account')}
                    className={`flex-row items-center gap-1 px-3 py-1.5 rounded-lg border ${
                      copiedField === 'account'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 active:bg-slate-100'
                    }`}
                  >
                    {copiedField === 'account' ? (
                      <CheckCircle2 color="#10b981" size={13} />
                    ) : (
                      <Copy color="#64748b" size={13} />
                    )}
                    <Text
                      className={`text-[11px] font-bold ${
                        copiedField === 'account' ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {copiedField === 'account' ? 'Đã sao chép' : 'Sao chép'}
                    </Text>
                  </Pressable>
                </View>

                {/* Reference Code with Highlight & Copy */}
                <View className="flex-row justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850 bg-orange-50/50 dark:bg-orange-950/20 -mx-4 px-4 rounded-b-xl">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs text-[#ea580c] font-bold">
                      Nội dung chuyển khoản (Bắt buộc)
                    </Text>
                    <Text className="text-[13px] font-mono text-[#ea580c] font-black mt-0.5">
                      {checkout.ref_code}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleCopy(checkout.ref_code, 'refCode')}
                    className={`flex-row items-center gap-1 px-3 py-1.5 rounded-lg border ${
                      copiedField === 'refCode'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300'
                        : 'bg-[#ea580c] border-[#ea580c] active:bg-[#f97316]'
                    }`}
                  >
                    {copiedField === 'refCode' ? (
                      <CheckCircle2 color="#10b981" size={13} />
                    ) : (
                      <Copy color="#ffffff" size={13} />
                    )}
                    <Text
                      className={`text-[11px] font-bold ${
                        copiedField === 'refCode' ? 'text-emerald-600' : 'text-white'
                      }`}
                    >
                      {copiedField === 'refCode' ? 'Đã sao chép' : 'Sao chép mã'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Waiting status pulse & helper notes */}
            <View className="mt-5 items-center justify-center">
              <View className="flex-row items-center gap-2 bg-slate-100 dark:bg-slate-900/60 px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-800">
                <ActivityIndicator size="small" color="#f97316" />
                <Text className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                  Đang chờ tiền về • Màn hình sẽ tự động cập nhật
                </Text>
              </View>

              <Text className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-4 font-semibold mt-3 px-2">
                Khi quét mã VietQR, số tiền và nội dung sẽ tự động được điền chính xác. Vui lòng không sửa nội dung chuyển tiền.
              </Text>
            </View>

            {/* Action buttons */}
            <View className="mt-6 gap-2.5">
              <Pressable
                disabled={isCheckingStatus}
                onPress={() => checkPaymentStatus(false)}
                className="w-full bg-[#ea580c] active:bg-[#f97316] py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
              >
                {isCheckingStatus ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <RefreshCw color="#ffffff" size={16} />
                )}
                <Text className="text-white text-sm font-bold uppercase tracking-wider">
                  Tôi đã chuyển tiền • Kiểm tra ngay
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                className="w-full bg-slate-100 dark:bg-slate-900 active:bg-slate-200 dark:active:bg-slate-800 py-3 rounded-xl items-center justify-center border border-slate-200 dark:border-slate-800"
              >
                <Text className="text-slate-600 dark:text-slate-300 text-xs font-bold">
                  Để sau / Xem đơn trong Lịch đặt
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
