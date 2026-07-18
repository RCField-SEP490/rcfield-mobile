import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Car,
  CheckCircle2,
  ImagePlus,
  Plus,
  ReceiptText,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { uploadImage } from '@/features/auth/api/auth.api';
import {
  staffApi,
  type DamageLineItemInput,
  type DamagePartType,
  type StaffInspectionItemStatus,
  type StaffInspectionType,
  type StaffSessionDetail,
} from '@/features/staff/api/staff.api';
import { getStatusLabel } from '@/features/bookings/lib/status-label';
import { ImageZoomModal } from '@/shared/ui/ImageZoomModal';
import { Text } from '@/shared/ui/Text';

type PhotoSlot = {
  key: string;
  label: string;
  angle: string;
  notes: string;
  uri?: string;
  url?: string;
  uploading: boolean;
};

type ChecklistItem = {
  itemKey: string;
  itemLabel: string;
  status: StaffInspectionItemStatus;
  note: string;
};

const MAX_INSPECTION_PHOTOS = 6;
const INSPECTION_ANGLES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'] as const;
const INSPECTION_IMAGE_MAX_EDGE = 1280;
const INSPECTION_IMAGE_COMPRESS = 0.55;
const INSPECTION_UPLOAD_TIMEOUT_MS = 90000;

function getInspectionUploadErrorMessage(error: any) {
  if (error?.code === 'ECONNABORTED') {
    return 'Upload ảnh quá lâu do mạng chậm hoặc ảnh quá nặng. Ảnh đã được nén, vui lòng thử lại.';
  }

  if (error?.response?.status === 413) {
    return 'Ảnh vẫn quá lớn sau khi nén. Vui lòng chụp lại gần hơn hoặc chọn ảnh nhẹ hơn.';
  }

  if (!error?.response && error?.message) {
    return 'Không kết nối được máy chủ upload. Kiểm tra Wi-Fi/4G và địa chỉ API rồi thử lại.';
  }

  return error?.response?.data?.message || 'Không thể upload ảnh kiểm xe.';
}

async function optimizeInspectionImage(asset: ImagePicker.ImagePickerAsset) {
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const actions =
    width > 0 && height > 0 && Math.max(width, height) > INSPECTION_IMAGE_MAX_EDGE
      ? [
          width >= height
            ? { resize: { width: INSPECTION_IMAGE_MAX_EDGE } }
            : { resize: { height: INSPECTION_IMAGE_MAX_EDGE } },
        ]
      : [];

  return manipulateAsync(asset.uri, actions, {
    compress: INSPECTION_IMAGE_COMPRESS,
    format: SaveFormat.JPEG,
  });
}

function createPhotoSlot(index: number): PhotoSlot {
  const angle = INSPECTION_ANGLES[index] ?? 'OTHER';
  return {
    key: `PHOTO_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    label: `Ảnh ${index + 1}`,
    angle,
    notes: '',
    uploading: false,
  };
}

function shortId(value?: string) {
  if (!value) return '--';
  return value.slice(0, 8).toUpperCase();
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function buildChecklist(type: StaffInspectionType, isByoc: boolean): ChecklistItem[] {
  if (isByoc) {
    return [
      {
        itemKey: 'byoc_shell',
        itemLabel: 'Xe BYOC đúng người chơi và đúng mô tả ban đầu',
        status: 'OK',
        note: '',
      },
      {
        itemKey: 'byoc_battery',
        itemLabel: 'Pin/nguồn BYOC an toàn, không phồng rộp hoặc nóng bất thường',
        status: 'OK',
        note: '',
      },
      {
        itemKey: 'byoc_track_safe',
        itemLabel: 'Xe BYOC đủ điều kiện chạy trên sân',
        status: 'OK',
        note: '',
      },
    ];
  }

  if (type === 'CHECK_IN') {
    return [
      {
        itemKey: 'body_shell',
        itemLabel: 'Vỏ xe và khung gầm không nứt/gãy trước bàn giao',
        status: 'OK',
        note: '',
      },
      {
        itemKey: 'steering',
        itemLabel: 'Hệ thống lái phản hồi ổn định',
        status: 'OK',
        note: '',
      },
      {
        itemKey: 'battery',
        itemLabel: 'Pin và nguồn điện hoạt động bình thường',
        status: 'OK',
        note: '',
      },
      {
        itemKey: 'tires',
        itemLabel: 'Bánh xe, lốp và hệ truyền động sẵn sàng',
        status: 'OK',
        note: '',
      },
    ];
  }

  return [
    {
      itemKey: 'return_body_shell',
      itemLabel: 'Vỏ xe và khung gầm sau phiên chạy',
      status: 'OK',
      note: '',
    },
    {
      itemKey: 'return_steering',
      itemLabel: 'Hệ thống lái sau phiên chạy',
      status: 'OK',
      note: '',
    },
    {
      itemKey: 'return_battery',
      itemLabel: 'Pin, nguồn điện và nhiệt độ xe sau phiên chạy',
      status: 'OK',
      note: '',
    },
    {
      itemKey: 'return_tires',
      itemLabel: 'Bánh xe, lốp và hệ truyền động sau phiên chạy',
      status: 'OK',
      note: '',
    },
  ];
}

function isByocSession(session?: StaffSessionDetail | null) {
  if (!session?.vehicles?.length) return false;
  return session.vehicles.every((vehicle) => vehicle.type === 'BYOC');
}

const DAMAGE_PART_LABELS: Record<DamagePartType, string> = {
  TIRE_WHEEL: 'Bánh xe / lốp',
  SPOILER: 'Cánh gió',
  CHASSIS: 'Khung gầm',
  MOTOR: 'Motor / động cơ',
  SHELL: 'Vỏ xe',
  SERVO: 'Servo / tay lái',
  REMOTE: 'Remote / điều khiển',
  OTHER: 'Khác',
};

export function StaffInspectionFormScreen({
  sessionId,
  type,
}: {
  sessionId: string;
  type: StaffInspectionType;
}) {
  const router = useRouter();
  const [session, setSession] = useState<StaffSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [staffNotes, setStaffNotes] = useState('');
  const [damageFlagged, setDamageFlagged] = useState(false);
  const [damageLineItems, setDamageLineItems] = useState<DamageLineItemInput[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const isByoc = useMemo(() => isByocSession(session), [session]);
  const totalDamageCharge = useMemo(
    () => damageLineItems.reduce((sum, item) => sum + Number(item.partsPrice || 0) + Number(item.laborPrice || 0), 0),
    [damageLineItems]
  );
  const isCheckIn = type === 'CHECK_IN';
  const requiresPhotos = !isByoc;

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await staffApi.getSessionDetail(sessionId);
      setSession(data);
      const byoc = isByocSession(data);
      setPhotos(byoc ? [] : [createPhotoSlot(0)]);
      setChecklist(buildChecklist(type, byoc));
      setStaffNotes(
        type === 'CHECK_IN'
          ? 'Biên bản nhận xe tạo từ staff mobile.'
          : 'Biên bản trả xe tạo từ staff mobile.'
      );
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể tải thông tin phiên.';
      Alert.alert('Lỗi', message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, type]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const updatePhotoSlot = (key: string, patch: Partial<PhotoSlot>) => {
    setPhotos((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));
  };

  const addPhotoSlot = () => {
    setPhotos((current) =>
      current.length >= MAX_INSPECTION_PHOTOS ? current : [...current, createPhotoSlot(current.length)]
    );
  };

  const removePhotoSlot = (key: string) => {
    setPhotos((current) => {
      const next = current.filter((slot) => slot.key !== key);
      return next.length ? next : [createPhotoSlot(0)];
    });
  };

  const requestImagePermission = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const result = await ImagePicker.requestCameraPermissionsAsync();
      return result.granted;
    }

    const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return result.granted;
  };

  const handlePickPhoto = async (slot: PhotoSlot, source: 'camera' | 'library') => {
    const granted = await requestImagePermission(source);
    if (!granted) {
      Alert.alert(
        'Thiếu quyền truy cập',
        source === 'camera'
          ? 'Vui lòng cấp quyền camera để chụp ảnh kiểm xe.'
          : 'Vui lòng cấp quyền thư viện ảnh để chọn ảnh kiểm xe.'
      );
      return;
    }

    try {
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.55,
              allowsEditing: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.55,
              allowsEditing: false,
              allowsMultipleSelection: true,
              selectionLimit: MAX_INSPECTION_PHOTOS,
            });

      if (result.canceled || !result.assets?.length) return;

      const availableCount = MAX_INSPECTION_PHOTOS - photos.length + 1;
      const selectedAssets = result.assets.slice(0, Math.max(1, availableCount));
      const extraSlots = selectedAssets.slice(1).map((_, index) => createPhotoSlot(photos.length + index));
      const uploadTargets = [slot, ...extraSlots];

      setPhotos((current) => {
        const slotIndex = current.findIndex((photo) => photo.key === slot.key);
        if (slotIndex < 0) return current;
        const firstAsset = selectedAssets[0];
        const next = current.map((photo) =>
          photo.key === slot.key ? { ...photo, uri: firstAsset.uri, url: undefined, uploading: true } : photo
        );
        return [...next, ...extraSlots.map((photo, index) => ({
          ...photo,
          uri: selectedAssets[index + 1]?.uri,
          uploading: true,
        }))].slice(0, MAX_INSPECTION_PHOTOS);
      });

      await Promise.all(
        selectedAssets.map(async (asset, index) => {
          const target = uploadTargets[index];
          try {
            const optimized = await optimizeInspectionImage(asset);
            updatePhotoSlot(target.key, { uri: optimized.uri, uploading: true });
            const uploaded = await uploadImage(optimized.uri, 'inspection-photo', {
              fileName: `inspection-${target.key.toLowerCase()}.jpg`,
              mimeType: 'image/jpeg',
              timeoutMs: INSPECTION_UPLOAD_TIMEOUT_MS,
            });
            updatePhotoSlot(target.key, { uri: optimized.uri, url: uploaded.url, uploading: false });
          } catch (error: any) {
            updatePhotoSlot(target.key, { uploading: false });
            throw error;
          }
        })
      );
    } catch (error: any) {
      setPhotos((current) => current.map((photo) => ({ ...photo, uploading: false })));
      const message = getInspectionUploadErrorMessage(error);
      Alert.alert('Lỗi upload ảnh', message);
    }
  };

  const updateChecklistStatus = (itemKey: string, ok: boolean) => {
    setChecklist((current) =>
      current.map((item) =>
        item.itemKey === itemKey ? { ...item, status: ok ? 'OK' : 'BROKEN' } : item
      )
    );
  };

  const updateChecklistNote = (itemKey: string, note: string) => {
    setChecklist((current) =>
      current.map((item) => (item.itemKey === itemKey ? { ...item, note } : item))
    );
  };

  const addDamageLineItem = () => {
    setDamageLineItems((current) => [
      ...current,
      { partType: 'TIRE_WHEEL', partsPrice: 0, laborPrice: 0 },
    ]);
  };

  const updateDamageLineItem = (
    index: number,
    field: keyof DamageLineItemInput,
    value: string | number
  ) => {
    setDamageLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeDamageLineItem = (index: number) => {
    setDamageLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const validate = () => {
    if (requiresPhotos) {
      const uploadedPhotos = photos.filter((photo) => !!photo.url);
      if (uploadedPhotos.length === 0) {
        Alert.alert(
          'Thiếu ảnh kiểm xe',
          'Vui lòng thêm ít nhất một ảnh thực tế của xe. Nên chụp đủ các góc để làm căn cứ bàn giao.'
        );
        return false;
      }
    }

    if (photos.some((photo) => photo.uploading)) {
      Alert.alert('Đang upload ảnh', 'Vui lòng chờ tất cả ảnh upload xong trước khi gửi biên bản.');
      return false;
    }

    if (damageFlagged && damageLineItems.length === 0) {
      Alert.alert('Thiếu hạng mục hư hỏng', 'Vui lòng thêm ít nhất một hạng mục bồi thường.');
      return false;
    }

    if (damageLineItems.some((item) => item.partType === 'OTHER' && !item.customPartName?.trim())) {
      Alert.alert('Thiếu tên hư hỏng', 'Vui lòng nhập tên hư hỏng cho hạng mục “Khác”.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await staffApi.submitInspection(sessionId, {
        type,
        photos: requiresPhotos
          ? photos.filter((photo) => !!photo.url).map((photo) => ({
              angle: photo.angle,
              url: photo.url || '',
              notes: photo.notes,
            }))
          : [],
        checklist: checklist.map((item) => ({
          itemKey: item.itemKey,
          itemLabel: item.itemLabel,
          status: item.status,
          note: item.note.trim(),
        })),
        staffNotes: staffNotes.trim(),
        damageFlagged: type === 'CHECK_OUT' && damageFlagged,
        damageLineItems:
          type === 'CHECK_OUT' && damageFlagged
            ? damageLineItems
            : undefined,
      });

      Alert.alert(
        'Đã gửi biên bản',
        isCheckIn
          ? 'Biên bản nhận xe đã được lưu và phiên có thể chuyển sang đang chạy.'
          : 'Biên bản trả xe đã được gửi. Khách sẽ nhận thông báo để xác nhận hoàn tất phiên.'
      );
      router.replace(`/staff/session/${sessionId}` as any);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Không thể gửi biên bản kiểm xe.';
      Alert.alert('Lỗi', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f8fafc] dark:bg-[#0b0f19]">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-3 text-[12px] text-slate-500">Đang tải thông tin kiểm xe...</Text>
      </SafeAreaView>
    );
  }

  const title = isCheckIn ? 'Biên bản nhận xe' : 'Biên bản trả xe';

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc] dark:bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-900 px-5 py-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]"
          >
            <ArrowLeft color="#e2e8f0" size={19} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[12px] uppercase tracking-wider text-slate-500 dark:text-slate-400" weight="700">
              Kiểm xe
            </Text>
            <Text className="mt-1 text-[19px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerClassName="px-5 py-5 pb-28" showsVerticalScrollIndicator={false}>
          <View className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/70 p-4 shadow-sm">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[16px] text-slate-900 dark:text-white" weight="700">
                  Phiên #{shortId(sessionId)}
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  Booking #{shortId(session?.bookingId)} • {session?.vehicles?.length || 0} xe •{' '}
                  {session?.participants?.length || 0} người chơi
                </Text>
              </View>
              <View className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-2 py-1">
                <Text className="text-[9px] uppercase text-[#fb923c]" weight="700">
                  {getStatusLabel(type)}
                </Text>
              </View>
            </View>

            {isByoc ? (
              <View className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <Text className="text-[12px] text-blue-700 dark:text-blue-300" weight="700">
                  Phiên khách mang xe riêng
                </Text>
                <Text className="mt-1 text-[11px] leading-4 text-blue-700/80 dark:text-blue-100/70">
                  Vẫn lập biên bản trả xe để nhân viên xác nhận hoàn tất phiên theo quy trình chính thức.
                </Text>
              </View>
            ) : null}
          </View>

          {session?.vehicles?.length ? (
            <View className="mb-5">
              <SectionTitle title="Xe trong phiên" />
              <View className="gap-3">
                {session.vehicles.map((vehicle) => (
                  <View
                  key={vehicle.vehicleId}
                  className="flex-row items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-3 shadow-sm"
                >
                  <View className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                    {vehicle.imageUrl ? (
                      <Image source={{ uri: vehicle.imageUrl }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Car color="#64748b" size={22} />
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] text-slate-900 dark:text-white" weight="700" numberOfLines={1}>
                      {vehicle.name || 'Xe trong phiên'}
                    </Text>
                      <Text className="mt-1 text-[11px] text-slate-500">{vehicle.type}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!isByoc ? (
            <>
              <View className="mb-3 flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <SectionTitle title="Ảnh kiểm xe" />
                  <Text className="-mt-2 text-[11px] leading-4 text-slate-500">
                    Thêm từ 1 đến 6 ảnh thực tế. Hãy chụp rõ các góc trước, sau, hai bên và điểm bất thường nếu có.
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500" weight="700">
                  {photos.filter((photo) => !!photo.url).length}/{MAX_INSPECTION_PHOTOS}
                </Text>
              </View>
              <View className="mb-5 gap-3">
                {photos.map((slot) => (
                  <PhotoSlotCard
                    key={slot.key}
                    slot={slot}
                    onPickCamera={() => handlePickPhoto(slot, 'camera')}
                    onPickLibrary={() => handlePickPhoto(slot, 'library')}
                    onRemove={() => removePhotoSlot(slot.key)}
                    removable={photos.length > 1 || !!slot.url}
                    onChangeNotes={(notes) => updatePhotoSlot(slot.key, { notes })}
                    onPreview={() => {
                      const url = slot.uri || slot.url;
                      if (url) setPreviewPhoto({ url, title: `${slot.label} · ${slot.angle}` });
                    }}
                  />
                ))}
                {photos.length < MAX_INSPECTION_PHOTOS ? (
                  <Pressable
                    onPress={addPhotoSlot}
                    className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-orange-500/50 bg-orange-500/5"
                  >
                    <Plus color="#fb923c" size={16} />
                    <Text className="text-[12px] text-[#fb923c]" weight="700">
                      Thêm ảnh
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}

          <SectionTitle title="Checklist kiểm tra" />
          <View className="mb-5 gap-3">
            {checklist.map((item) => (
              <ChecklistCard
                key={item.itemKey}
                item={item}
                onToggle={(ok) => updateChecklistStatus(item.itemKey, ok)}
                onChangeNote={(note) => updateChecklistNote(item.itemKey, note)}
              />
            ))}
          </View>

          {type === 'CHECK_OUT' && !isByoc ? (
            <View className="mb-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
                    Ghi nhận hư hỏng/phí phát sinh
                  </Text>
                  <Text className="mt-1 text-[11px] leading-4 text-slate-500">
                    Bật mục này nếu xe có hư hỏng cần khách xác nhận khi trả xe.
                  </Text>
                </View>
                <Switch
                  value={damageFlagged}
                  onValueChange={(enabled) => {
                    setDamageFlagged(enabled);
                    setDamageLineItems((current) =>
                      enabled && current.length === 0
                        ? [{ partType: 'TIRE_WHEEL', partsPrice: 0, laborPrice: 0 }]
                        : enabled
                          ? current
                          : []
                    );
                  }}
                  trackColor={{ false: '#1e293b', true: '#f97316' }}
                  thumbColor="#ffffff"
                />
              </View>

              {damageFlagged ? (
                <View className="gap-3">
                  <Text className="text-[11px] leading-4 text-slate-500">
                    Ghi từng hạng mục để khách xem rõ tiền linh kiện và công sửa. Không áp dụng hệ số giá tự động.
                  </Text>
                  {damageLineItems.map((item, index) => (
                    <DamageLineItemCard
                      key={`${item.partType}-${index}`}
                      item={item}
                      index={index}
                      onChange={updateDamageLineItem}
                      onRemove={() => removeDamageLineItem(index)}
                    />
                  ))}
                  <Pressable
                    onPress={addDamageLineItem}
                    className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10"
                  >
                    <Plus color="#fb923c" size={15} />
                    <Text className="text-[11px] text-[#fb923c]" weight="700">
                      Thêm hạng mục
                    </Text>
                  </Pressable>
                  <View className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-[11px] text-red-200" weight="700">
                        Tổng phí bồi thường
                      </Text>
                      <Text className="text-[14px] text-red-200" weight="700">
                        {formatCurrency(totalDamageCharge)}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <SectionTitle title="Ghi chú staff" />
          <TextInput
            value={staffNotes}
            onChangeText={setStaffNotes}
            multiline
            placeholder="Ghi chú bổ sung cho biên bản..."
            placeholderTextColor="#64748b"
            className="mb-5 min-h-[96px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 px-4 py-3 text-[12px] text-slate-900 dark:text-white"
            style={{ textAlignVertical: 'top' }}
          />

          <View className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <View className="flex-row gap-2">
              <AlertTriangle color="#f59e0b" size={16} />
              <Text className="flex-1 text-[11px] leading-4 text-amber-100/80">
                Sau khi gửi biên bản trả xe, khách sẽ nhận thông báo để xem ảnh, checklist và xác nhận
                hoàn tất. Nếu khách từ chối, phiên sẽ quay lại trạng thái cần xử lý.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View className="border-t border-slate-200 dark:border-slate-900 bg-[#f8fafc] dark:bg-[#0b0f19] px-5 py-4">
          <Pressable
            disabled={submitting}
            onPress={handleSubmit}
            className={`h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#ea580c] ${
              submitting ? 'opacity-70' : ''
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <ReceiptText color="#ffffff" size={17} />
            )}
            <Text className="text-[13px] text-white" weight="700">
              Gửi {title.toLowerCase()}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ImageZoomModal
        visible={!!previewPhoto}
        imageUrl={previewPhoto?.url}
        title={previewPhoto?.title}
        onClose={() => setPreviewPhoto(null)}
      />
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="mb-3 text-[12px] uppercase tracking-wider text-slate-400" weight="700">
      {title}
    </Text>
  );
}

function PhotoSlotCard({
  slot,
  onPickCamera,
  onPickLibrary,
  onRemove,
  removable,
  onChangeNotes,
  onPreview,
}: {
  slot: PhotoSlot;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onRemove: () => void;
  removable: boolean;
  onChangeNotes: (notes: string) => void;
  onPreview: () => void;
}) {
  const hasPhoto = !!slot.uri || !!slot.url;

  return (
    <View className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]/60 p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View>
          <Text className="text-[13px] text-slate-900 dark:text-white" weight="700">
            {slot.label}
          </Text>
          <Text className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{slot.angle}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {slot.url ? (
            <View className="flex-row items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
              <CheckCircle2 color="#34d399" size={12} />
              <Text className="text-[9px] text-emerald-300" weight="700">
                Đã upload
              </Text>
            </View>
          ) : null}
          {removable ? (
            <Pressable
              disabled={slot.uploading}
              onPress={onRemove}
              className="h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10"
            >
              <Trash2 color="#f87171" size={13} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
        {hasPhoto ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Phóng to ${slot.label}`}
            onPress={onPreview}
            className="h-full w-full"
          >
            <Image source={{ uri: slot.uri || slot.url }} className="h-full w-full" resizeMode="cover" />
            {slot.uploading ? (
              <View className="absolute inset-0 items-center justify-center bg-black/60">
                <ActivityIndicator color="#ffffff" />
                <Text className="mt-2 text-[11px] text-white" weight="700">
                  Đang nén & upload...
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View className="h-full w-full items-center justify-center gap-2">
            <ImagePlus color="#475569" size={30} />
            <Text className="text-[11px] text-slate-500" weight="700">
              Chưa có ảnh
            </Text>
          </View>
        )}
      </View>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          disabled={slot.uploading}
          onPress={onPickCamera}
          className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10"
        >
          <Camera color="#fb923c" size={15} />
          <Text className="text-[11px] text-[#fb923c]" weight="700">
            Chụp ảnh
          </Text>
        </Pressable>
        <Pressable
          disabled={slot.uploading}
          onPress={onPickLibrary}
          className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950"
        >
          <UploadCloud color="#cbd5e1" size={15} />
          <Text className="text-[11px] text-slate-200" weight="700">
            Chọn ảnh
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={slot.notes}
        onChangeText={onChangeNotes}
        placeholder="Ghi chú cho ảnh này..."
        placeholderTextColor="#64748b"
        className="mt-3 min-h-[44px] rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-white"
        style={{ textAlignVertical: 'top' }}
      />
    </View>
  );
}

function DamageLineItemCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: DamageLineItemInput;
  index: number;
  onChange: (index: number, field: keyof DamageLineItemInput, value: string | number) => void;
  onRemove: () => void;
}) {
  const lineTotal = Number(item.partsPrice || 0) + Number(item.laborPrice || 0);

  return (
    <View className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-[11px] text-slate-900 dark:text-white" weight="700">
          Hạng mục {index + 1}
        </Text>
        <Pressable onPress={onRemove} className="h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
          <Trash2 color="#f87171" size={14} />
        </Pressable>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {(Object.keys(DAMAGE_PART_LABELS) as DamagePartType[]).map((partType) => {
          const selected = item.partType === partType;
          return (
            <Pressable
              key={partType}
              onPress={() => onChange(index, 'partType', partType)}
              className={`rounded-lg border px-2.5 py-2 ${
                selected
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19]'
              }`}
            >
              <Text className={`text-[10px] ${selected ? 'text-[#fb923c]' : 'text-slate-500'}`} weight="700">
                {DAMAGE_PART_LABELS[partType]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {item.partType === 'OTHER' ? (
        <TextInput
          value={item.customPartName || ''}
          onChangeText={(value) => onChange(index, 'customPartName', value)}
          placeholder="Tên hư hỏng cụ thể"
          placeholderTextColor="#64748b"
          className="mb-3 h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-3 text-[12px] text-slate-900 dark:text-white"
        />
      ) : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="mb-1 text-[10px] text-slate-500" weight="700">
            Linh kiện (đ)
          </Text>
          <TextInput
            value={item.partsPrice ? String(item.partsPrice) : ''}
            onChangeText={(value) => onChange(index, 'partsPrice', Number(value.replace(/[^\d]/g, '') || 0))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#64748b"
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-3 text-[12px] text-slate-900 dark:text-white"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 text-[10px] text-slate-500" weight="700">
            Công sửa (đ)
          </Text>
          <TextInput
            value={item.laborPrice ? String(item.laborPrice) : ''}
            onChangeText={(value) => onChange(index, 'laborPrice', Number(value.replace(/[^\d]/g, '') || 0))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#64748b"
            className="h-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] px-3 text-[12px] text-slate-900 dark:text-white"
          />
        </View>
      </View>

      <View className="mt-3 flex-row justify-between">
        <Text className="text-[10px] text-slate-500">Tổng hạng mục</Text>
        <Text className="text-[11px] text-slate-900 dark:text-white" weight="700">
          {formatCurrency(lineTotal)}
        </Text>
      </View>
    </View>
  );
}

function ChecklistCard({
  item,
  onToggle,
  onChangeNote,
}: {
  item: ChecklistItem;
  onToggle: (ok: boolean) => void;
  onChangeNote: (note: string) => void;
}) {
  const ok = item.status === 'OK';

  return (
    <View
      className={`rounded-2xl border p-4 ${
        ok ? 'border-slate-800 bg-[#0f172a]/60' : 'border-amber-500/30 bg-amber-500/10'
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`mt-0.5 h-9 w-9 items-center justify-center rounded-xl border ${
            ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
          }`}
        >
          {ok ? <ShieldCheck color="#34d399" size={17} /> : <XCircle color="#f59e0b" size={17} />}
        </View>
        <View className="flex-1">
          <Text className="text-[12px] text-white" weight="700">
            {item.itemLabel}
          </Text>
          <Text className="mt-1 text-[10px] uppercase tracking-wider text-slate-500" weight="700">
            {ok ? 'Đạt' : 'Cần kiểm tra lại'}
          </Text>
        </View>
        <Switch
          value={ok}
          onValueChange={onToggle}
          trackColor={{ false: '#92400e', true: '#047857' }}
          thumbColor="#ffffff"
        />
      </View>

      {!ok || item.note ? (
        <TextInput
          value={item.note}
          onChangeText={onChangeNote}
          placeholder="Ghi chú tình trạng hoặc điểm cần theo dõi..."
          placeholderTextColor="#64748b"
          className="mt-3 min-h-[44px] rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-white"
          style={{ textAlignVertical: 'top' }}
        />
      ) : null}
    </View>
  );
}
