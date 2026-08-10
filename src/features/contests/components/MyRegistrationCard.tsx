import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Calendar, QrCode, CreditCard, Trash2, Edit } from 'lucide-react-native';
import type { ContestRegistration } from '../types/contests.types';

interface MyRegistrationCardProps {
  registration: ContestRegistration;
  onPayPress: (registrationId: string) => void;
  onCancelPress: (registrationId: string) => void;
  onEditByocPress: (registration: ContestRegistration) => void;
  onPressCard: (contestId: string) => void;
}

export const MyRegistrationCard: React.FC<MyRegistrationCardProps> = ({
  registration,
  onPayPress,
  onCancelPress,
  onEditByocPress,
  onPressCard
}) => {
  const contest = registration.contest;
  if (!contest) return null;

  const getRegStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'CONFIRMED':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'CHECKED_IN':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'CANCELLED':
        return 'bg-red-50 text-red-600 border border-red-100';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-100';
    }
  };

  const getRegStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Chờ duyệt';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'CHECKED_IN':
        return 'Đã Check-in';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return 'Chờ thanh toán';
      case 'PENDING_REVIEW':
        return 'Chờ duyệt phí';
      case 'MARKED_PAID':
        return 'Đã thanh toán';
      case 'WAIVED':
        return 'Miễn phí (Ưu đãi)';
      case 'NOT_REQUIRED':
        return 'Không yêu cầu phí';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'MARKED_PAID':
      case 'WAIVED':
      case 'NOT_REQUIRED':
        return 'text-emerald-700 font-bold';
      case 'PENDING_PAYMENT':
        return 'text-red-500 font-bold';
      case 'PENDING_REVIEW':
        return 'text-amber-600 font-bold';
      default:
        return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Chưa định ngày';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${registration.check_in_code}`;
  const defaultBanner = 'https://images.unsplash.com/photo-1568605117036-5fecc6207a71?auto=format&fit=crop&w=600&q=80';

  const showCancelConfirm = () => {
    Alert.alert(
      'Hủy đăng ký giải đấu',
      'Bạn có chắc chắn muốn hủy đăng ký tham gia giải đấu này không? Lệ phí hoàn trả (nếu có) sẽ được xử lý thủ công theo chính sách.',
      [
        { text: 'Quay lại', style: 'cancel' },
        { text: 'Đồng ý hủy', style: 'destructive', onPress: () => onCancelPress(registration.id) },
      ]
    );
  };

  const canCancel = registration.status !== 'CANCELLED' && contest.status === 'OPEN';
  const canEditByoc = registration.vehicle_source === 'BYOC' && registration.status === 'PENDING';
  const showPayButton = registration.payment_status === 'PENDING_PAYMENT' && registration.status !== 'CANCELLED';

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      {/* Header Info */}
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => onPressCard(contest.id)}
        className="flex-row items-center border-b border-gray-50 dark:border-slate-800/60 pb-3"
      >
        <Image
          source={contest.banner_image_url ? { uri: contest.banner_image_url } : { uri: defaultBanner }}
          className="h-16 w-16 rounded-xl object-cover"
          resizeMode="cover"
        />
        <View className="ml-3 flex-1">
          <Text className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight mb-1" numberOfLines={2}>
            {contest.name}
          </Text>
          <View className="flex-row items-center">
            <Calendar color="#94a3b8" size={12} style={{ marginRight: 4 }} />
            <Text className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">
              {formatDate(contest.starts_at)}
            </Text>
          </View>
        </View>
        
        {/* Status Tag */}
        <View className="ml-2">
          <View className={`rounded-full px-2 py-0.5 ${getRegStatusStyle(registration.status)}`}>
            <Text className="text-[10px] font-extrabold uppercase">
              {getRegStatusText(registration.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Detail Grid */}
      <View className="my-3 space-y-2">
        <View className="flex-row justify-between items-center">
          <Text className="text-xs font-semibold text-gray-500 dark:text-slate-450">Hình thức xe:</Text>
          <Text className="text-xs font-bold text-gray-800 dark:text-slate-200">
            {registration.vehicle_source === 'RENTAL' ? 'Thuê xe của cơ sở' : 'Xe cá nhân tự mang (BYOC)'}
          </Text>
        </View>

        {registration.vehicle_source === 'BYOC' && registration.metadata?.byoc_declaration && (
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-semibold text-gray-500 dark:text-slate-450">Xe đăng ký:</Text>
            <Text className="text-xs font-bold text-gray-800 dark:text-slate-200" numberOfLines={1}>
              {registration.metadata.byoc_declaration.vehicle_brand} - {registration.metadata.byoc_declaration.vehicle_name}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-center">
          <Text className="text-xs font-semibold text-gray-500 dark:text-slate-450">Lệ phí giải:</Text>
          <Text className="text-xs font-extrabold text-gray-800 dark:text-slate-200">
            {contest.entry_fee === 0 ? 'Miễn phí' : `${contest.entry_fee.toLocaleString('vi-VN')} VND`}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-xs font-semibold text-gray-500 dark:text-slate-450">Trạng thái phí:</Text>
          <Text className={`text-xs ${getPaymentStatusColor(registration.payment_status)}`}>
            {getPaymentStatusText(registration.payment_status)}
          </Text>
        </View>
      </View>

      {/* QR Code and checkInCode (Only when confirmed or checked in) */}
      {registration.status !== 'CANCELLED' && (
        <View className="my-2 items-center justify-center rounded-xl bg-gray-50 dark:bg-slate-900/30 p-4 border border-gray-100/60 dark:border-slate-800/80">
          <Image
            source={{ uri: qrCodeUrl }}
            className="h-32 w-32 mb-2 bg-white p-1 rounded-lg"
          />
          <View className="flex-row items-center">
            <QrCode size={14} color="#94a3b8" style={{ marginRight: 4 }} />
            <Text className="text-xs font-extrabold tracking-wider text-gray-700 dark:text-slate-350">
              Mã Check-in: {registration.check_in_code}
            </Text>
          </View>
          <Text className="text-[10px] font-medium text-gray-400 dark:text-slate-500 mt-1">
            Đưa mã này cho nhân viên quét điểm danh ngày thi đấu
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2 mt-2">
        {/* Nút sửa xe BYOC */}
        {canEditByoc && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onEditByocPress(registration)}
            className="flex-1 flex-row items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 bg-white dark:bg-slate-900/40"
          >
            <Edit size={14} color="#4b5563" style={{ marginRight: 6 }} />
            <Text className="text-xs font-bold text-gray-700 dark:text-slate-350">Sửa xe BYOC</Text>
          </TouchableOpacity>
        )}

        {/* Nút thanh toán */}
        {showPayButton && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPayPress(registration.id)}
            className="flex-1 flex-row items-center justify-center rounded-xl bg-emerald-600 py-2.5"
          >
            <CreditCard size={14} color="#ffffff" style={{ marginRight: 6 }} />
            <Text className="text-xs font-extrabold text-white">Thanh toán VNPay</Text>
          </TouchableOpacity>
        )}

        {/* Nút hủy */}
        {canCancel && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={showCancelConfirm}
            className="flex-row items-center justify-center rounded-xl border border-red-100 bg-red-50/50 px-4 py-2.5"
          >
            <Trash2 size={14} color="#ef4444" style={{ marginRight: 4 }} />
            <Text className="text-xs font-bold text-red-500">Hủy</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
