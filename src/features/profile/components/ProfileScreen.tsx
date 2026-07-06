import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Mail,
  Phone,
  LockKeyhole,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  Bell,
  User,
  Save,
  Crown,
  Gem,
  Award,
  ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMe, updateMe, changePassword, uploadImage } from '@/features/auth/api/auth.api';
import { getMyBookings } from '@/features/bookings/api/booking.api';
import { useAuthStore } from '@/shared/store/auth-store';
import { Text } from '@/shared/ui/Text';

export function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const displayName = user?.fullName ?? user?.email ?? 'RCField User';
  const email = user?.email ?? 'user@rcfield.vn';

  const [bookingCount, setBookingCount] = useState(0);

  useEffect(() => {
    getMyBookings({ limit: 1 })
      .then((res) => {
        setBookingCount(res.total);
      })
      .catch((err) => {
        console.error('Error fetching bookings total for profile stats:', err);
      });
  }, []);

  const { points, memberTier, pointsToNextTier, progress, tierColor, tierBg, nextTierLabel } = useMemo(() => {
    const pts = bookingCount * 500;
    let tier = 'Standard Member';
    let nextTier = 'Bronze';
    let ptsToNext = 1500 - pts;
    let prog = pts / 1500;
    let color = '#94a3b8'; // slate-400
    let bg = 'bg-slate-500/10 border-slate-500/20';

    if (pts >= 25000) {
      tier = 'Platinum Member';
      nextTier = '';
      ptsToNext = 0;
      prog = 1.0;
      color = '#38bdf8'; // sky-400
      bg = 'bg-sky-500/10 border-sky-500/20';
    } else if (pts >= 10000) {
      tier = 'Gold Member';
      nextTier = 'Platinum';
      ptsToNext = 25000 - pts;
      prog = (pts - 10000) / 15000;
      color = '#eab308'; // yellow-500
      bg = 'bg-yellow-500/10 border-yellow-500/20';
    } else if (pts >= 5000) {
      tier = 'Silver Member';
      nextTier = 'Gold';
      ptsToNext = 10000 - pts;
      prog = (pts - 5000) / 5000;
      color = '#cbd5e1'; // slate-300
      bg = 'bg-slate-300/10 border-slate-300/20';
    } else if (pts >= 1500) {
      tier = 'Bronze Member';
      nextTier = 'Silver';
      ptsToNext = 5000 - pts;
      prog = (pts - 1500) / 3500;
      color = '#b45309'; // amber-700
      bg = 'bg-amber-700/10 border-amber-700/20';
    }

    return {
      points: pts,
      memberTier: tier,
      pointsToNextTier: ptsToNext,
      progress: Math.min(100, Math.max(0, prog * 100)),
      tierColor: color,
      tierBg: bg,
      nextTierLabel: nextTier,
    };
  }, [bookingCount]);

  const [firstName, lastName] = useMemo(() => splitName(displayName), [displayName]);

  // States cho Form Thông tin cá nhân
  const [form, setForm] = useState({
    firstName: firstName,
    lastName: lastName,
    email: email,
    phone: user?.phone ?? '',
    avatarUrl: user?.avatarUrl ?? '',
  });

  // Cập nhật lại form state khi user store thay đổi
  useEffect(() => {
    setForm({
      firstName,
      lastName,
      email,
      phone: user?.phone ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    });
  }, [email, firstName, lastName, user?.avatarUrl, user?.phone]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // States cho Form Đổi mật khẩu
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Hàm validate form đổi mật khẩu inline
  const validatePasswordForm = () => {
    const errors = {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    };
    let isValid = true;

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
      isValid = false;
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
      isValid = false;
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Mật khẩu mới phải từ 6 ký tự trở lên.';
      isValid = false;
    }

    if (!passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'Vui lòng xác nhận mật khẩu mới.';
      isValid = false;
    } else if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'Mật khẩu mới nhập lại không trùng khớp.';
      isValid = false;
    }

    setPasswordErrors(errors);
    return isValid;
  };

  // States cho Cài đặt thông báo (Mô phỏng lưu trữ local)
  const [emailMarketing, setEmailMarketing] = useState(true);
  const [smsReminder, setSmsReminder] = useState(true);

  // Tự động đồng bộ profile từ server khi load màn hình
  useEffect(() => {
    let mounted = true;
    getMe()
      .then((profile) => {
        if (!mounted) return;
        setUser(profile);
      })
      .catch((err) => {
        console.error('Error fetching profile detail:', err);
      });

    return () => {
      mounted = false;
    };
  }, [setUser]);

  // Hàm lưu thông tin cá nhân
  const handleSaveProfile = async (nextAvatarUrl = form.avatarUrl) => {
    if (!form.firstName.trim()) {
      Alert.alert('Lỗi', 'Họ không được để trống.');
      return;
    }
    if (!form.lastName.trim()) {
      Alert.alert('Lỗi', 'Tên không được để trống.');
      return;
    }
    
    // Validate phone number cơ bản của Việt Nam
    if (form.phone.trim()) {
      const phoneRegex = /^(03|05|07|08|09|84[3|5|7|8|9])([0-9]{8})$/;
      if (!phoneRegex.test(form.phone.trim())) {
        Alert.alert('Lỗi', 'Số điện thoại không đúng định dạng Việt Nam.');
        return;
      }
    }

    setSavingProfile(true);
    try {
      const updatedUser = await updateMe({
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        phone: form.phone.trim() || null,
        avatarUrl: nextAvatarUrl || null,
      });
      setUser(updatedUser);
      Alert.alert('Thành công', 'Đã cập nhật thông tin hồ sơ.');
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Không thể lưu thay đổi. Vui lòng thử lại.';
      Alert.alert('Lỗi', errMsg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Hàm chọn và upload avatar
  const handleSelectAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh để đổi ảnh đại diện.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]?.uri) {
        return;
      }

      setUploadingAvatar(true);
      const imageUri = pickerResult.assets[0].uri;
      
      // Upload lên cloud
      const uploadRes = await uploadImage(imageUri, 'profile-avatar');
      
      // Cập nhật URL avatar mới trong form
      setForm((prev) => ({ ...prev, avatarUrl: uploadRes.url }));
      
      // Lưu trực tiếp
      await handleSaveProfile(uploadRes.url);
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Không thể tải ảnh đại diện lên.';
      Alert.alert('Lỗi upload', errMsg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Hàm xóa ảnh đại diện
  const handleRemoveAvatar = async () => {
    setForm((prev) => ({ ...prev, avatarUrl: '' }));
    await handleSaveProfile('');
  };

  // Hàm đổi mật khẩu
  const handleChangePassword = async () => {
    if (!validatePasswordForm()) {
      return;
    }

    setChangingPw(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      // Reset form sau khi thành công
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setPasswordErrors({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });

      Alert.alert(
        'Thành công',
        'Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.';
      // Nếu là lỗi từ server liên quan đến mật khẩu cũ, hiển thị ở input mật khẩu hiện tại
      setPasswordErrors((prev) => ({
        ...prev,
        currentPassword: errMsg,
      }));
    } finally {
      setChangingPw(false);
    }
  };

  // Đăng xuất tài khoản
  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  // Xóa tài khoản
  const handleDeleteAccount = () => {
    Alert.alert(
      'Xóa tài khoản',
      'Tính năng xóa tài khoản đang được phát triển. Vui lòng gửi email đến support@rcfield.vn để yêu cầu xóa dữ liệu.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      {/* Background Glows (Hiệu ứng ánh sáng thể thao) */}
      <View className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#f97316]/10 blur-3xl pointer-events-none" />
      <View className="absolute bottom-10 -left-20 w-80 h-80 rounded-full bg-[#6366f1]/10 blur-3xl pointer-events-none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow px-5 py-6 pb-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Màn hình */}
          <View className="mb-6">
            <Text className="text-white text-3xl" variant="title" weight="700">
              Hồ sơ cá nhân
            </Text>
            <Text className="mt-1.5 text-[14px] leading-5 text-slate-400 font-semibold">
              Quản lý thông tin tài khoản, bảo mật và cài đặt thông báo của bạn.
            </Text>
          </View>

          {/* Section: Avatar */}
          <View className="items-center mb-6 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-6 shadow-2xl">
            <Pressable
              className="relative group size-24 rounded-full border-2 border-slate-700 overflow-hidden bg-slate-900 justify-center items-center"
              onPress={handleSelectAvatar}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color="#f97316" size="small" />
              ) : form.avatarUrl ? (
                <Image
                  source={{ uri: form.avatarUrl }}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                <Text className="text-3xl font-bold text-[#f97316]">
                  {getInitials(displayName)}
                </Text>
              )}
              
              <View className="absolute bottom-0 right-0 left-0 bg-black/40 py-1 items-center">
                <Camera color="#ffffff" size={14} />
              </View>
            </Pressable>

            <View className="flex-row gap-3 mt-4">
              <Pressable
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 active:bg-slate-800"
                onPress={handleSelectAvatar}
                disabled={uploadingAvatar || savingProfile}
              >
                <Text className="text-[13px] text-slate-200 font-bold">
                  Tải ảnh mới
                </Text>
              </Pressable>
              
              {form.avatarUrl ? (
                <Pressable
                  className="px-4 py-2 rounded-xl bg-red-950/20 border border-red-900/30 active:bg-red-950/40"
                  onPress={handleRemoveAvatar}
                  disabled={uploadingAvatar || savingProfile}
                >
                  <Text className="text-[13px] text-red-400 font-bold">
                    Xóa ảnh
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="mt-3 text-[11px] text-slate-400 text-center leading-4 font-medium">
              Khuyên dùng ảnh định dạng JPG, PNG hoặc WEBP.{'\n'}Kích thước tối đa 5MB.
            </Text>
          </View>

          {/* Section: Hạng thành viên & Điểm tin cậy (Premium Loyaty Card) */}
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6 relative overflow-hidden">
            {/* Thanh màu phản quang theo hạng */}
            <View className="absolute top-0 right-0 left-0 h-[3px]" style={{ backgroundColor: tierColor }} />
            
            <View className="flex-row items-center justify-between mb-3.5">
              <Text className="text-[12px] font-bold text-white uppercase tracking-wider">
                Hạng thành viên
              </Text>
              <View className={`px-2.5 py-0.5 rounded-full border ${tierBg}`}>
                <Text className="text-[9px] font-black uppercase tracking-wide" style={{ color: tierColor }}>
                  {memberTier}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-4 mb-4">
              <View className="size-12 rounded-xl bg-slate-900 border border-slate-800 justify-center items-center shadow-lg">
                {memberTier.includes('Gold') ? (
                  <Crown color={tierColor} size={22} />
                ) : memberTier.includes('Platinum') ? (
                  <Gem color={tierColor} size={22} />
                ) : memberTier.includes('Silver') ? (
                  <ShieldCheck color={tierColor} size={22} />
                ) : (
                  <Award color={tierColor} size={22} />
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-xl text-white font-extrabold" style={{ color: tierColor }}>
                    {points.toLocaleString('vi-VN')}
                  </Text>
                  <Text className="text-slate-400 text-xs font-bold">
                    điểm
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-400 font-semibold mt-0.5">
                  Tích lũy từ {bookingCount} lượt chơi đã đặt
                </Text>
              </View>
            </View>

            {/* Thanh tiến trình thăng hạng */}
            {pointsToNextTier > 0 ? (
              <View className="space-y-1.5">
                <View className="flex-row justify-between text-[10.5px] font-bold">
                  <Text className="text-slate-400">Tiến trình lên {nextTierLabel}</Text>
                  <Text style={{ color: tierColor }}>Còn {pointsToNextTier.toLocaleString('vi-VN')} điểm</Text>
                </View>
                <View className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <View 
                    className="h-full rounded-full" 
                    style={{ width: `${progress}%`, backgroundColor: tierColor }} 
                  />
                </View>
              </View>
            ) : (
              <View className="rounded-lg bg-sky-500/5 border border-sky-500/10 py-2 items-center">
                <Text className="text-[10px] text-sky-400 font-black tracking-wide uppercase">
                  🏆 Bạn đã đạt hạng thành viên cao nhất!
                </Text>
              </View>
            )}

            {/* Điểm uy tín (Trust Score) */}
            <View className="w-full h-[1px] bg-slate-800/80 my-4" />
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-[13px] font-bold text-white">Điểm uy tín (Trust Score)</Text>
                <Text className="text-[10px] text-slate-400 font-semibold leading-4 mt-0.5">
                  Quyết định quyền hạn đặt lịch chơi và hoàn tiền của bạn.
                </Text>
              </View>
              <View className="flex-row items-baseline gap-0.5">
                <Text className="text-lg font-black text-emerald-500">
                  {user?.trustScore ?? 100}
                </Text>
                <Text className="text-slate-400 text-xs font-bold">/100</Text>
              </View>
            </View>
          </View>

          {/* Section: Thông tin cơ bản */}
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center mb-4 gap-2 border-b border-slate-800/80 pb-2">
              <User color="#f97316" size={18} />
              <Text className="text-[15px] font-bold text-white uppercase tracking-wider">
                Thông tin cơ bản
              </Text>
            </View>

            <View className="gap-4">
              {/* Họ */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Họ
                </Text>
                <View className="h-11 flex-row items-center rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 focus:border-[#f97316]">
                  <TextInput
                    className="flex-1 text-[14px] text-white font-medium"
                    editable={!savingProfile}
                    onChangeText={(val) => setForm((prev) => ({ ...prev, firstName: val }))}
                    placeholder="Nguyễn"
                    placeholderTextColor="#475569"
                    value={form.firstName}
                  />
                </View>
              </View>

              {/* Tên */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Tên
                </Text>
                <View className="h-11 flex-row items-center rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 focus:border-[#f97316]">
                  <TextInput
                    className="flex-1 text-[14px] text-white font-medium"
                    editable={!savingProfile}
                    onChangeText={(val) => setForm((prev) => ({ ...prev, lastName: val }))}
                    placeholder="Văn A"
                    placeholderTextColor="#475569"
                    value={form.lastName}
                  />
                </View>
              </View>

              {/* Email */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Email Address
                </Text>
                <View className="h-11 flex-row items-center rounded-xl border border-slate-800/50 bg-slate-950/80 px-3.5 opacity-60">
                  <Mail color="#475569" size={16} />
                  <TextInput
                    className="ml-2.5 flex-1 text-[14px] text-slate-400 font-medium"
                    editable={false}
                    value={form.email}
                  />
                </View>
              </View>

              {/* Số điện thoại */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Số điện thoại
                </Text>
                <View className="h-11 flex-row items-center rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 focus:border-[#f97316]">
                  <Phone color="#94a3b8" size={16} />
                  <TextInput
                    className="ml-2.5 flex-1 text-[14px] text-white font-medium"
                    editable={!savingProfile}
                    keyboardType="phone-pad"
                    onChangeText={(val) => setForm((prev) => ({ ...prev, phone: val }))}
                    placeholder="0987654321"
                    placeholderTextColor="#475569"
                    value={form.phone}
                  />
                </View>
              </View>

              {/* Button Save */}
              <Pressable
                className={`h-11 flex-row items-center justify-center rounded-xl bg-[#ea580c] active:bg-[#f97316] gap-2 mt-2 ${savingProfile ? 'opacity-70' : ''}`}
                disabled={savingProfile}
                onPress={() => handleSaveProfile()}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Save color="#ffffff" size={16} />
                    <Text className="text-[14px] text-white font-bold">
                      Lưu thay đổi
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Section: Cài đặt thông báo */}
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center mb-4 gap-2 border-b border-slate-800/80 pb-2">
              <Bell color="#f97316" size={18} />
              <Text className="text-[15px] font-bold text-white uppercase tracking-wider">
                Cài đặt nhận thông báo
              </Text>
            </View>

            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-[14px] font-semibold text-white">
                    Email Marketing
                  </Text>
                  <Text className="text-[11px] text-slate-400 font-medium leading-4 mt-0.5">
                    Nhận thông tin tin tức khuyến mãi, giải đua và các sự kiện hấp dẫn từ hệ thống.
                  </Text>
                </View>
                <Switch
                  value={emailMarketing}
                  onValueChange={setEmailMarketing}
                  trackColor={{ false: '#1e293b', true: '#ea580c' }}
                  thumbColor="#ffffff"
                />
              </View>

              <View className="w-full h-[1px] bg-slate-800/80" />

              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-[14px] font-semibold text-white">
                    SMS Booking Reminders
                  </Text>
                  <Text className="text-[11px] text-slate-400 font-medium leading-4 mt-0.5">
                    Tự động nhận tin nhắn SMS nhắc nhở lịch đặt sân 1 tiếng trước khi bắt đầu.
                  </Text>
                </View>
                <Switch
                  value={smsReminder}
                  onValueChange={setSmsReminder}
                  trackColor={{ false: '#1e293b', true: '#ea580c' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </View>

          {/* Section: Đổi mật khẩu */}
          <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-5 shadow-2xl mb-6">
            <View className="flex-row items-center mb-4 gap-2 border-b border-slate-800/80 pb-2">
              <LockKeyhole color="#f97316" size={18} />
              <Text className="text-[15px] font-bold text-white uppercase tracking-wider">
                Đổi mật khẩu
              </Text>
            </View>

            <View className="gap-4">
              {/* Mật khẩu hiện tại */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Mật khẩu hiện tại
                </Text>
                <View className={`h-11 flex-row items-center rounded-xl border bg-slate-900/80 px-3.5 focus:border-[#f97316] ${passwordErrors.currentPassword ? 'border-red-500' : 'border-slate-800'}`}>
                  <TextInput
                    autoCapitalize="none"
                    className="flex-1 text-[14px] text-white font-medium py-0"
                    editable={!changingPw}
                    onChangeText={(val) => {
                      setPasswordForm((prev) => ({ ...prev, currentPassword: val }));
                      if (passwordErrors.currentPassword) {
                        setPasswordErrors((prev) => ({ ...prev, currentPassword: '' }));
                      }
                    }}
                    placeholder="••••••••"
                    placeholderTextColor="#475569"
                    secureTextEntry={!showCurrentPassword}
                    value={passwordForm.currentPassword}
                  />
                  <Pressable onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    {showCurrentPassword ? (
                      <EyeOff color={passwordErrors.currentPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    ) : (
                      <Eye color={passwordErrors.currentPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    )}
                  </Pressable>
                </View>
                {passwordErrors.currentPassword ? (
                  <Text className="mt-1.5 text-[11.5px] text-red-500 font-semibold">
                    {passwordErrors.currentPassword}
                  </Text>
                ) : null}
              </View>

              {/* Mật khẩu mới */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Mật khẩu mới
                </Text>
                <View className={`h-11 flex-row items-center rounded-xl border bg-slate-900/80 px-3.5 focus:border-[#f97316] ${passwordErrors.newPassword ? 'border-red-500' : 'border-slate-800'}`}>
                  <TextInput
                    autoCapitalize="none"
                    className="flex-1 text-[14px] text-white font-medium py-0"
                    editable={!changingPw}
                    onChangeText={(val) => {
                      setPasswordForm((prev) => ({ ...prev, newPassword: val }));
                      if (passwordErrors.newPassword) {
                        setPasswordErrors((prev) => ({ ...prev, newPassword: '' }));
                      }
                    }}
                    placeholder="••••••••"
                    placeholderTextColor="#475569"
                    secureTextEntry={!showNewPassword}
                    value={passwordForm.newPassword}
                  />
                  <Pressable onPress={() => setShowNewPassword(!showNewPassword)}>
                    {showNewPassword ? (
                      <EyeOff color={passwordErrors.newPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    ) : (
                      <Eye color={passwordErrors.newPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    )}
                  </Pressable>
                </View>
                {passwordErrors.newPassword ? (
                  <Text className="mt-1.5 text-[11.5px] text-red-500 font-semibold">
                    {passwordErrors.newPassword}
                  </Text>
                ) : null}
              </View>

              {/* Nhập lại mật khẩu mới */}
              <View>
                <Text className="mb-1.5 text-[11px] uppercase text-slate-400 tracking-wider font-bold">
                  Nhập lại mật khẩu mới
                </Text>
                <View className={`h-11 flex-row items-center rounded-xl border bg-slate-900/80 px-3.5 focus:border-[#f97316] ${passwordErrors.confirmNewPassword ? 'border-red-500' : 'border-slate-800'}`}>
                  <TextInput
                    autoCapitalize="none"
                    className="flex-1 text-[14px] text-white font-medium py-0"
                    editable={!changingPw}
                    onChangeText={(val) => {
                      setPasswordForm((prev) => ({ ...prev, confirmNewPassword: val }));
                      if (passwordErrors.confirmNewPassword) {
                        setPasswordErrors((prev) => ({ ...prev, confirmNewPassword: '' }));
                      }
                    }}
                    placeholder="••••••••"
                    placeholderTextColor="#475569"
                    secureTextEntry={!showConfirmNewPassword}
                    value={passwordForm.confirmNewPassword}
                  />
                  <Pressable onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}>
                    {showConfirmNewPassword ? (
                      <EyeOff color={passwordErrors.confirmNewPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    ) : (
                      <Eye color={passwordErrors.confirmNewPassword ? '#ef4444' : '#94a3b8'} size={16} />
                    )}
                  </Pressable>
                </View>
                {passwordErrors.confirmNewPassword ? (
                  <Text className="mt-1.5 text-[11.5px] text-red-500 font-semibold">
                    {passwordErrors.confirmNewPassword}
                  </Text>
                ) : null}
              </View>

              {/* Button Submit Change Password */}
              <Pressable
                className={`h-11 flex-row items-center justify-center rounded-xl bg-slate-950 border border-[#f97316]/20 shadow-md mt-2 active:bg-slate-900 ${changingPw ? 'opacity-70' : ''}`}
                disabled={changingPw}
                onPress={handleChangePassword}
              >
                {changingPw ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text className="text-[14px] text-white font-bold">
                    Cập nhật mật khẩu
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Section: Hành động khác (Đăng xuất, Xóa tài khoản) */}
          <View className="gap-3.5">
            <Pressable
              className="h-12 flex-row items-center justify-center rounded-xl border border-red-900/20 bg-red-950/10 active:bg-red-950/20 gap-2.5"
              onPress={handleDeleteAccount}
            >
              <Trash2 color="#f87171" size={18} />
              <Text className="text-[14px] text-red-400 font-bold">
                Xóa tài khoản cá nhân
              </Text>
            </Pressable>

            <Pressable
              className="h-12 flex-row items-center justify-center rounded-xl border border-slate-800 bg-[#0f172a]/40 active:bg-[#0f172a]/70 gap-2.5"
              onPress={handleLogout}
            >
              <LogOut color="#94a3b8" size={18} />
              <Text className="text-[14px] text-slate-300 font-bold">
                Đăng xuất tài khoản
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Hàm chia họ và tên từ fullName
function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] ?? '', ''];
  return [parts[0], parts.slice(1).join(' ')];
}

// Hàm lấy ký tự đầu làm Avatar Placeholder
function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(-2)
    .toUpperCase();
}
