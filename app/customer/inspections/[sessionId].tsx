import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react-native';
import { bookingWizardApi } from '@/features/bookings/api/booking-wizard.api';
import { Text } from '@/shared/ui/Text';

function formatCurrency(value?: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function InspectionReviewScreen() {
  const { sessionId, inspectionId } = useLocalSearchParams<{
    sessionId?: string | string[];
    inspectionId?: string | string[];
  }>();
  const router = useRouter();
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedInspectionId = Array.isArray(inspectionId) ? inspectionId[0] : inspectionId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  // States cho việc Từ chối
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [disagreementNote, setDisagreementNote] = useState('');

  // States cho Zoom ảnh
  const [zoomModalVisible, setZoomModalVisible] = useState(false);

  // Countdown timer: 15 phút (900 giây) mặc định
  const [timeLeft, setTimeLeft] = useState(900);

  // Tìm inspection đang hiển thị
  const inspection = useMemo(() => {
    if (!sessionDetail?.inspections) return null;
    if (normalizedInspectionId) {
      return sessionDetail.inspections.find((i: any) => i.inspectionId === normalizedInspectionId);
    }
    // Nếu không truyền inspectionId, lấy cái mới nhất
    return sessionDetail.inspections[sessionDetail.inspections.length - 1];
  }, [sessionDetail, normalizedInspectionId]);

  const photos = useMemo(() => {
    return inspection?.photos || [];
  }, [inspection]);

  const checklist = useMemo(() => {
    return (inspection?.checklist || []).map((item: any) => ({
      ...item,
      label: item.label || item.itemLabel || 'Hạng mục kiểm tra',
      notes: item.notes || item.note || '',
      status: item.status || 'OK',
    }));
  }, [inspection]);

  const isCheckIn = inspection?.type === 'CHECK_IN';
  const canRespond = !!inspection && !isCheckIn && inspection.customerConfirmed !== true;

  const damageSummary = useMemo(() => {
    const claim = sessionDetail?.damageClaim;
    if (!inspection?.damageFlagged && !claim) return null;

    const estimatedCost = Number(claim?.estimatedCost ?? inspection?.estimatedCost ?? 0);
    const damageMultiplier = Number(claim?.damageMultiplier ?? inspection?.damageMultiplier ?? 1);
    const finalCharge = Number(claim?.finalCharge ?? inspection?.finalCharge ?? estimatedCost * damageMultiplier);

    return {
      description:
        claim?.description || inspection?.damageDescription || inspection?.staffNotes || 'Có ghi nhận hư hỏng cần xác nhận.',
      estimatedCost,
      damageMultiplier,
      finalCharge,
    };
  }, [inspection, sessionDetail]);

  const handleAutoConfirm = useCallback(async () => {
    if (!inspection || !normalizedSessionId || !canRespond) return;
    try {
      await bookingWizardApi.confirmInspection(normalizedSessionId, inspection.inspectionId, {
        agreed: true,
      });
      Alert.alert('Hết giờ', 'Đã tự động xác nhận đồng ý biên bản trả xe.');
      router.back();
    } catch (err) {
      console.error('Auto-confirm inspection failed:', err);
    }
  }, [canRespond, inspection, normalizedSessionId, router]);

  // Load chi tiết session
  const fetchSessionDetail = useCallback(async () => {
    setLoading(true);
    try {
      if (normalizedSessionId) {
        const data = await bookingWizardApi.getSessionDetail(normalizedSessionId);
        setSessionDetail(data);
      }
    } catch (error) {
      console.error('Failed to load session detail for inspection:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin biên bản kiểm xe.');
    } finally {
      setLoading(false);
    }
  }, [normalizedSessionId]);

  useEffect(() => {
    fetchSessionDetail();
  }, [fetchSessionDetail]);

  // Countdown logic
  useEffect(() => {
    if (!canRespond) {
      return;
    }

    if (timeLeft <= 0) {
      // Hết hạn ký nhận, tự động đồng ý
      handleAutoConfirm();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [canRespond, timeLeft, handleAutoConfirm]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirm = async () => {
    if (!inspection || !normalizedSessionId || !canRespond) return;
    setSubmitting(true);
    try {
      await bookingWizardApi.confirmInspection(normalizedSessionId, inspection.inspectionId, {
        agreed: true,
      });
      Alert.alert('Thành công', 'Bạn đã đồng ý biên bản trả xe và hoàn tất xác nhận checkout.');
      router.back();
    } catch (error) {
      console.error('Confirm inspection failed:', error);
      Alert.alert('Lỗi', 'Không thể gửi xác nhận. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!inspection || !normalizedSessionId || !canRespond) return;
    if (!disagreementNote.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do từ chối biên bản kiểm xe.');
      return;
    }
    setSubmitting(true);
    try {
      await bookingWizardApi.confirmInspection(normalizedSessionId, inspection.inspectionId, {
        agreed: false,
        disagreementNote,
      });
      Alert.alert(
        'Từ chối thành công',
        'Đã gửi phản hồi sai lệch tới nhân viên. Vui lòng đợi nhân viên kiểm tra lại xe.'
      );
      setRejectModalVisible(false);
      router.back();
    } catch (error) {
      console.error('Reject inspection failed:', error);
      Alert.alert('Lỗi', 'Không thể gửi từ chối. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="text-slate-400 mt-3 text-sm">Đang tải biên bản kiểm xe...</Text>
      </View>
    );
  }

  if (!inspection) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center px-6">
        <XCircle color="#ef4444" size={48} />
        <Text className="text-white font-bold text-lg mt-4 text-center">Không tìm thấy biên bản</Text>
        <Text className="text-slate-400 text-sm mt-1 text-center">
          Biên bản kiểm xe không tồn tại hoặc đã bị hủy.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-6 bg-slate-900 border border-slate-800 px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-bold text-xs">Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPhoto = photos[currentPhotoIdx];

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-900 bg-slate-950/80">
        <TouchableOpacity onPress={() => router.back()} className="p-1 rounded-lg bg-slate-900 border border-slate-800">
          <ArrowLeft color="#fff" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-bold text-base">Kiểm Xe {isCheckIn ? 'Bàn Giao' : 'Trả Xe'}</Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Quy trình & Countdown Card */}
        <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mt-4 shadow-xl">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-2">
              <Text className="text-orange-500 font-bold text-[10px] uppercase tracking-wider mb-1">
                {isCheckIn ? 'QUY TRÌNH BÀN GIAO XE (CHECK-IN)' : 'QUY TRÌNH KIỂM XE TRẢ (CHECK-OUT)'}
              </Text>
              <Text className="text-white font-bold text-lg leading-6 mb-1">
                {isCheckIn ? 'Kiểm Tra Tình Trạng Bàn Giao' : 'Kiểm Tra Tình Trạng Trả Xe'}
              </Text>
              <Text className="text-slate-400 text-[10px] font-semibold leading-4">
                Phiên chơi:{' '}
                <Text className="text-slate-300 font-mono">
                  {normalizedSessionId?.substring(0, 8).toUpperCase()}
                </Text>{' '}
                {'\n'}
                Nhân viên: <Text className="text-slate-300">{sessionDetail?.staffName || 'Nhân viên trực ca'}</Text>
              </Text>
            </View>

            {canRespond ? (
              <View className="bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl flex-row items-center gap-1.5">
                <Clock color="#ef4444" size={14} />
                <View>
                  <Text className="text-red-400 text-[8px] font-bold uppercase tracking-wider">Hết hạn sau</Text>
                  <Text className="text-red-400 font-mono text-xs font-black">{formatTime(timeLeft)}</Text>
                </View>
              </View>
            ) : (
              <View className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl flex-row items-center gap-1.5">
                <CheckCircle2 color="#34d399" size={14} />
                <View>
                  <Text className="text-emerald-300 text-[8px] font-bold uppercase tracking-wider">Trạng thái</Text>
                  <Text className="text-emerald-300 text-xs font-black">Đã ghi nhận</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Warning Banner */}
        <View className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5 mt-3 flex-row gap-2.5 items-start">
          <AlertTriangle color="#f59e0b" size={16} className="mt-0.5" />
          <Text className="text-amber-500/90 text-[11px] font-semibold leading-4 flex-1">
            Lưu ý: Vui lòng xem kỹ các góc ảnh chụp thực tế dưới đây. Bất kỳ điểm sai lệch nào cần được phản hồi ngay để staff kiểm tra lại trước khi tiếp tục quy trình.
          </Text>
        </View>

        {damageSummary ? (
          <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mt-4 shadow-xl">
            <View className="flex-row items-start gap-2.5">
              <AlertTriangle color="#ef4444" size={17} />
              <View className="flex-1">
                <Text className="text-red-300 font-bold text-xs uppercase tracking-wider">
                  Hư hỏng/phí phát sinh
                </Text>
                <Text className="text-red-100/80 text-[11px] leading-4 mt-1">
                  {damageSummary.description}
                </Text>
              </View>
            </View>
            <View className="mt-3 rounded-xl border border-red-500/20 bg-slate-950/50 p-3">
              <View className="flex-row justify-between gap-3">
                <Text className="text-red-100/60 text-[11px]">Chi phí dự kiến</Text>
                <Text className="text-red-100 text-[11px] font-bold">
                  {formatCurrency(damageSummary.estimatedCost)}
                </Text>
              </View>
              <View className="mt-2 flex-row justify-between gap-3">
                <Text className="text-red-100/60 text-[11px]">Hệ số hư hỏng</Text>
                <Text className="text-red-100 text-[11px] font-bold">x{damageSummary.damageMultiplier}</Text>
              </View>
              <View className="mt-2 flex-row justify-between gap-3">
                <Text className="text-red-100/60 text-[11px]">Tổng tính phí</Text>
                <Text className="text-red-300 text-[12px] font-black">
                  {formatCurrency(damageSummary.finalCharge)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Photo Section */}
        <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mt-4 shadow-xl">
          {photos.length > 0 ? (
            <View>
              {/* Main Photo Card */}
              <View className="w-full aspect-[4/3] rounded-xl bg-slate-950 border border-slate-900 overflow-hidden relative">
                <Image
                  source={{ uri: currentPhoto?.url }}
                  className="w-full h-full object-cover"
                />
                
                {/* Angle Tag */}
                <View className="absolute top-3 left-3 bg-black/70 px-2.5 py-1 rounded-md border border-slate-800">
                  <Text className="text-[10px] text-white uppercase font-black tracking-wider">
                    Góc: {currentPhoto?.angle || 'PHOTO'}
                  </Text>
                </View>

                {/* Zoom Button */}
                <TouchableOpacity
                  onPress={() => setZoomModalVisible(true)}
                  className="absolute bottom-3 right-3 bg-black/70 p-2 rounded-lg border border-slate-800"
                >
                  <ZoomIn color="#fff" size={16} />
                </TouchableOpacity>
              </View>

              {/* Angle Description */}
              <View className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-900/50">
                <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">Ghi chú ảnh của staff</Text>
                <Text className="text-slate-300 text-xs font-semibold mt-0.5">
                  {currentPhoto?.notes || `Ảnh kiểm xe góc ${currentPhoto?.angle || ''}`}
                </Text>
              </View>

              {/* Slider Controller Buttons */}
              <View className="flex-row items-center justify-between mt-4">
                <TouchableOpacity
                  disabled={currentPhotoIdx === 0}
                  onPress={() => setCurrentPhotoIdx((p) => p - 1)}
                  className={`px-4 py-2 rounded-lg border flex-row items-center gap-1 ${
                    currentPhotoIdx === 0
                      ? 'border-slate-900 bg-slate-950/30'
                      : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <Text className={`text-xs font-bold ${currentPhotoIdx === 0 ? 'text-slate-600' : 'text-white'}`}>
                    ‹ Góc trước
                  </Text>
                </TouchableOpacity>

                <Text className="text-slate-400 font-bold text-xs">
                  Góc {currentPhotoIdx + 1} / {photos.length}
                </Text>

                <TouchableOpacity
                  disabled={currentPhotoIdx === photos.length - 1}
                  onPress={() => setCurrentPhotoIdx((p) => p + 1)}
                  className={`px-4 py-2 rounded-lg border flex-row items-center gap-1 ${
                    currentPhotoIdx === photos.length - 1
                      ? 'border-slate-900 bg-slate-950/30'
                      : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <Text className={`text-xs font-bold ${currentPhotoIdx === photos.length - 1 ? 'text-slate-600' : 'text-white'}`}>
                    Góc sau ›
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Thumbnails Row */}
              <View className="flex-row gap-2 mt-4 justify-center">
                {photos.map((p: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setCurrentPhotoIdx(idx)}
                    className={`w-14 aspect-square rounded-lg overflow-hidden border-2 ${
                      idx === currentPhotoIdx ? 'border-orange-500' : 'border-slate-800 opacity-60'
                    }`}
                  >
                    <Image source={{ uri: p.url }} className="w-full h-full object-cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View className="w-full aspect-[4/3] rounded-xl bg-slate-950 border border-slate-900 justify-center items-center p-6">
              <Camera color="#475569" size={32} />
              <Text className="text-slate-500 font-bold text-xs mt-2">Chưa cập nhật ảnh</Text>
            </View>
          )}
        </View>

        {/* Checklist Section */}
        <View className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mt-4 shadow-xl">
          <View className="flex-row items-center gap-2 mb-3.5 border-b border-slate-800/80 pb-2.5">
            <CheckCircle2 color="#10b981" size={16} />
            <View>
              <Text className="text-white font-bold text-xs">CHECKLIST AN TOÀN THIẾT BỊ</Text>
              <Text className="text-slate-500 text-[9px] font-bold mt-0.5">Nhân viên đã kiểm thử thực tế và tick chọn.</Text>
            </View>
          </View>

          {checklist.length > 0 ? (
            <View className="space-y-2">
              {checklist.map((item: any, idx: number) => (
                <View
                  key={idx}
                  className="flex-row items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-900/60"
                >
                  <View
                    className={`p-1.5 rounded-full border ${
                      item.status === 'OK'
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                    }`}
                  >
                    {item.status === 'OK' ? (
                      <CheckCircle2 color="#10b981" size={14} />
                    ) : (
                      <AlertTriangle color="#f59e0b" size={14} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-200 text-xs font-semibold">{item.label}</Text>
                    {item.notes ? (
                      <Text className="text-slate-500 text-[10px] mt-0.5">Ghi chú: {item.notes}</Text>
                    ) : null}
                  </View>
                  <Text
                    className={`text-[9px] font-bold ${item.status === 'OK' ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {item.status}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="p-3 rounded-xl bg-slate-950 border border-slate-900/60 flex-row items-center gap-3">
              <View className="bg-emerald-500/10 p-1.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 color="#10b981" size={14} />
              </View>
              <Text className="text-slate-300 text-xs font-semibold">Tất cả linh kiện đã qua kiểm tra an toàn</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {canRespond ? (
          <View className="mt-6 gap-3">
            <TouchableOpacity
              disabled={submitting}
              onPress={handleConfirm}
              className="w-full bg-[#0a0f1d] border border-orange-500/30 h-12 rounded-xl justify-center items-center shadow-lg active:opacity-80 flex-row gap-2"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <>
                  <CheckCircle2 color="#f97316" size={16} />
                  <Text className="text-orange-500 font-bold text-xs uppercase tracking-wider">
                    Tôi đồng ý biên bản trả xe & Hoàn tất
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={submitting}
              onPress={() => setRejectModalVisible(true)}
              className="w-full bg-red-500/5 border border-red-500/20 h-12 rounded-xl justify-center items-center active:opacity-80 flex-row gap-2 mt-2"
            >
              <XCircle color="#ef4444" size={16} />
              <Text className="text-red-400 font-bold text-xs uppercase tracking-wider">
                Tôi phát hiện sai lệch / Từ chối trả xe
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <View className="flex-row items-center gap-2">
              <CheckCircle2 color="#34d399" size={16} />
              <Text className="text-emerald-300 text-xs font-bold">
                Biên bản này đã được ghi nhận, không cần thao tác thêm.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal Zoom ảnh */}
      <Modal visible={zoomModalVisible} transparent={true} animationType="fade">
        <View className="flex-1 bg-black justify-center items-center relative">
          <TouchableOpacity
            onPress={() => setZoomModalVisible(false)}
            className="absolute top-12 right-6 p-2 rounded-full bg-slate-900 border border-slate-800 z-50"
          >
            <XCircle color="#fff" size={24} />
          </TouchableOpacity>
          {currentPhoto?.url && (
            <Image
              source={{ uri: currentPhoto.url }}
              className="w-full h-auto aspect-[4/3] object-contain"
            />
          )}
        </View>
      </Modal>

      {/* Modal từ chối (Disagreement Reason) */}
      <Modal visible={rejectModalVisible} transparent={true} animationType="slide">
        <View className="flex-1 bg-black/80 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 pb-10 space-y-4">
              <View className="flex-row justify-between items-center border-b border-slate-800 pb-3">
                <Text className="text-white font-bold text-base">Lý Do Từ Chối Biên Bản</Text>
                <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                  <XCircle color="#94a3b8" size={22} />
                </TouchableOpacity>
              </View>

              <Text className="text-slate-400 text-xs leading-4">
                Vui lòng chỉ rõ điểm không đồng ý hoặc sai lệch về hình ảnh/checklist xe để nhân viên trực ca thực hiện điều chỉnh và bàn giao lại.
              </Text>

              <TextInput
                multiline
                numberOfLines={4}
                value={disagreementNote}
                onChangeText={setDisagreementNote}
                placeholder="Nhập lý do chi tiết (ví dụ: ảnh xe không khớp, xước cánh gió nhưng chưa note, v.v.)..."
                placeholderTextColor="#475569"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white text-xs font-semibold leading-5 text-start"
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />

              <View className="flex-row gap-3 pt-2">
                <TouchableOpacity
                  onPress={() => setRejectModalVisible(false)}
                  className="flex-1 bg-slate-950 border border-slate-800 h-11 rounded-xl justify-center items-center"
                >
                  <Text className="text-slate-400 font-bold text-xs">Hủy bỏ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={submitting}
                  onPress={handleReject}
                  className="flex-1 bg-red-600 h-11 rounded-xl justify-center items-center shadow-lg active:opacity-90 flex-row gap-1.5"
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <XCircle color="#fff" size={14} />
                      <Text className="text-white font-bold text-xs">Gửi từ chối</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
