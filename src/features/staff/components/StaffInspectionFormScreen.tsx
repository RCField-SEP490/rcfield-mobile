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
  ReceiptText,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { uploadImage } from '@/features/auth/api/auth.api';
import {
  staffApi,
  type StaffInspectionItemStatus,
  type StaffInspectionType,
  type StaffSessionDetail,
} from '@/features/staff/api/staff.api';
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

const RENTAL_PHOTO_SLOTS: PhotoSlot[] = [
  {
    key: 'FRONT',
    label: 'Góc trước',
    angle: 'FRONT',
    notes: 'Ảnh góc trước xe trước khi xác nhận.',
    uploading: false,
  },
  {
    key: 'BACK',
    label: 'Góc sau',
    angle: 'BACK',
    notes: 'Ảnh góc sau xe trước khi xác nhận.',
    uploading: false,
  },
  {
    key: 'LEFT',
    label: 'Bên trái',
    angle: 'LEFT',
    notes: 'Ảnh hông trái xe trước khi xác nhận.',
    uploading: false,
  },
  {
    key: 'RIGHT',
    label: 'Bên phải',
    angle: 'RIGHT',
    notes: 'Ảnh hông phải xe trước khi xác nhận.',
    uploading: false,
  },
];

const BYOC_ANGLES = ['FRONT', 'BACK', 'LEFT', 'RIGHT'];
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

function clonePhotoSlots(slots: PhotoSlot[]) {
  return slots.map((slot) => ({ ...slot }));
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

function buildByocPhotoSlots(session: StaffSessionDetail): PhotoSlot[] {
  const participants = session.participants?.length ? session.participants : [{ name: 'Người chơi BYOC', type: 'BYOC' }];

  return participants.map((participant, index) => {
    const angle = BYOC_ANGLES[index % BYOC_ANGLES.length];
    const name = participant.name || `Người chơi ${index + 1}`;
    return {
      key: `BYOC_${index}`,
      label: `Xe BYOC - ${name}`,
      angle,
      notes: `Ảnh xe BYOC của ${name}.`,
      uploading: false,
    };
  });
}

function isByocSession(session?: StaffSessionDetail | null) {
  if (!session?.vehicles?.length) return false;
  return session.vehicles.every((vehicle) => vehicle.type === 'BYOC');
}

function getDamageMultiplier(session?: StaffSessionDetail | null) {
  const catalogMultiplier = Math.max(
    ...((session?.vehicles ?? [])
      .map((vehicle) => Number(vehicle.damageMultiplier) || 0)
      .filter((value) => value > 0)),
    0
  );
  if (catalogMultiplier > 0) return catalogMultiplier;

  const hasPremiumVehicle = session?.vehicles?.some((vehicle) =>
    /premium|pro|gtr|gt-r|limited|carbon/i.test(vehicle.name || '')
  );
  return hasPremiumVehicle ? 1.5 : 1;
}

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
  const [closingByoc, setClosingByoc] = useState(false);
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [staffNotes, setStaffNotes] = useState('');
  const [damageFlagged, setDamageFlagged] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [estimatedCostText, setEstimatedCostText] = useState('0');

  const isByoc = useMemo(() => isByocSession(session), [session]);
  const damageMultiplier = useMemo(() => getDamageMultiplier(session), [session]);
  const estimatedCost = useMemo(() => Number(estimatedCostText.replace(/[^\d]/g, '') || 0), [estimatedCostText]);
  const finalCharge = useMemo(
    () => Math.round(estimatedCost * damageMultiplier),
    [estimatedCost, damageMultiplier]
  );
  const isCheckIn = type === 'CHECK_IN';
  const requiresPhotos = !(isByoc && type === 'CHECK_OUT');

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await staffApi.getSessionDetail(sessionId);
      setSession(data);
      const byoc = isByocSession(data);
      setPhotos(byoc && type === 'CHECK_IN' ? buildByocPhotoSlots(data) : clonePhotoSlots(RENTAL_PHOTO_SLOTS));
      setChecklist(buildChecklist(type, byoc));
      setStaffNotes(
        type === 'CHECK_IN'
          ? 'Biên bản nhận xe tạo từ staff mobile.'
          : byoc
            ? 'Phiên BYOC được đóng từ staff mobile.'
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
            });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      updatePhotoSlot(slot.key, { uri, uploading: true });
      const optimized = await optimizeInspectionImage(asset);
      updatePhotoSlot(slot.key, { uri: optimized.uri, uploading: true });
      const uploaded = await uploadImage(optimized.uri, 'inspection-photo', {
        fileName: `inspection-${slot.key.toLowerCase()}.jpg`,
        mimeType: 'image/jpeg',
        timeoutMs: INSPECTION_UPLOAD_TIMEOUT_MS,
      });
      updatePhotoSlot(slot.key, {
        uri: optimized.uri,
        url: uploaded.url,
        uploading: false,
      });
    } catch (error: any) {
      updatePhotoSlot(slot.key, { uploading: false });
      const message = getInspectionUploadErrorMessage(error);
      Alert.alert('Lỗi upload ảnh', message);
    }
  };

  const updateChecklistStatus = (itemKey: string, ok: boolean) => {
    setChecklist((current) =>
      current.map((item) =>
        item.itemKey === itemKey ? { ...item, status: ok ? 'OK' : 'NEEDS_REVIEW' } : item
      )
    );
  };

  const updateChecklistNote = (itemKey: string, note: string) => {
    setChecklist((current) =>
      current.map((item) => (item.itemKey === itemKey ? { ...item, note } : item))
    );
  };

  const handleCloseByoc = () => {
    Alert.alert(
      'Đóng phiên BYOC',
      'Phiên BYOC không cần biên bản trả xe bắt buộc. Xác nhận đóng phiên và hoàn tất checkout?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đóng phiên',
          onPress: async () => {
            setClosingByoc(true);
            try {
              await staffApi.simulateClientCheckOut(sessionId);
              Alert.alert('Đã hoàn tất', 'Phiên BYOC đã được đóng.');
              router.replace(`/staff/session/${sessionId}` as any);
            } catch (error: any) {
              const message = error?.response?.data?.message || 'Không thể đóng phiên BYOC.';
              Alert.alert('Lỗi', message);
            } finally {
              setClosingByoc(false);
            }
          },
        },
      ]
    );
  };

  const validate = () => {
    if (requiresPhotos) {
      const missing = photos.filter((photo) => !photo.url);
      if (missing.length > 0) {
        Alert.alert(
          'Thiếu ảnh kiểm xe',
          `Vui lòng chụp hoặc chọn đủ ảnh cho: ${missing.map((photo) => photo.label).join(', ')}.`
        );
        return false;
      }
    }

    if (photos.some((photo) => photo.uploading)) {
      Alert.alert('Đang upload ảnh', 'Vui lòng chờ tất cả ảnh upload xong trước khi gửi biên bản.');
      return false;
    }

    if (damageFlagged && !damageDescription.trim()) {
      Alert.alert('Thiếu mô tả hư hỏng', 'Vui lòng ghi rõ tình trạng hư hỏng trước khi gửi biên bản trả xe.');
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
          ? photos.map((photo) => ({
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
        staffNotes:
          type === 'CHECK_OUT' && damageFlagged
            ? damageDescription.trim()
            : staffNotes.trim(),
        damageFlagged: type === 'CHECK_OUT' && damageFlagged,
        damageDetails:
          type === 'CHECK_OUT' && damageFlagged
            ? {
                description: damageDescription.trim(),
                estimatedCost,
                damageMultiplier,
                finalCharge,
              }
            : undefined,
      });

      Alert.alert(
        'Đã gửi biên bản',
        isCheckIn
          ? 'Biên bản nhận xe đã được lưu và phiên có thể chuyển sang đang chạy.'
          : 'Biên bản trả xe đã được gửi. Khách sẽ nhận thông báo để xác nhận checkout.'
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
      <SafeAreaView className="flex-1 items-center justify-center bg-[#0b0f19]">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-3 text-[12px] text-slate-500">Đang tải thông tin kiểm xe...</Text>
      </SafeAreaView>
    );
  }

  const title = isCheckIn ? 'Biên bản nhận xe' : 'Biên bản trả xe';

  return (
    <SafeAreaView className="flex-1 bg-[#0b0f19]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-3 border-b border-slate-900 px-5 py-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#0f172a]"
          >
            <ArrowLeft color="#e2e8f0" size={19} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[12px] uppercase tracking-wider text-slate-500" weight="700">
              Staff inspection
            </Text>
            <Text className="mt-1 text-[19px] text-white" weight="700" numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerClassName="px-5 py-5 pb-28" showsVerticalScrollIndicator={false}>
          <View className="mb-5 rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-[16px] text-white" weight="700">
                  Phiên #{shortId(sessionId)}
                </Text>
                <Text className="mt-1 text-[11px] text-slate-500">
                  Booking #{shortId(session?.bookingId)} • {session?.vehicles?.length || 0} xe •{' '}
                  {session?.participants?.length || 0} người chơi
                </Text>
              </View>
              <View className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-2 py-1">
                <Text className="text-[9px] uppercase text-[#fb923c]" weight="700">
                  {type}
                </Text>
              </View>
            </View>

            {isByoc && type === 'CHECK_OUT' ? (
              <View className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <Text className="text-[12px] text-emerald-300" weight="700">
                  Phiên BYOC không cần kiểm xe trả bắt buộc
                </Text>
                <Text className="mt-1 text-[11px] leading-4 text-emerald-100/70">
                  Nếu không có phát sinh tại quầy, staff có thể đóng phiên để hoàn tất checkout.
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
                    className="flex-row items-center gap-3 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-3"
                  >
                    <View className="h-14 w-14 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                      {vehicle.imageUrl ? (
                        <Image source={{ uri: vehicle.imageUrl }} className="h-full w-full" resizeMode="cover" />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Car color="#64748b" size={22} />
                        </View>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
                        {vehicle.name || 'Xe trong phiên'}
                      </Text>
                      <Text className="mt-1 text-[11px] text-slate-500">{vehicle.type}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {isByoc && type === 'CHECK_OUT' ? (
            <Pressable
              disabled={closingByoc}
              onPress={handleCloseByoc}
              className={`mb-5 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-600 ${
                closingByoc ? 'opacity-70' : ''
              }`}
            >
              {closingByoc ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <CheckCircle2 color="#ffffff" size={17} />
              )}
              <Text className="text-[13px] text-white" weight="700">
                Đóng phiên BYOC
              </Text>
            </Pressable>
          ) : (
            <>
              <SectionTitle title="Ảnh kiểm xe" />
              <View className="mb-5 gap-3">
                {photos.map((slot) => (
                  <PhotoSlotCard
                    key={slot.key}
                    slot={slot}
                    onPickCamera={() => handlePickPhoto(slot, 'camera')}
                    onPickLibrary={() => handlePickPhoto(slot, 'library')}
                    onChangeNotes={(notes) => updatePhotoSlot(slot.key, { notes })}
                  />
                ))}
              </View>
            </>
          )}

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
            <View className="mb-5 rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[13px] text-white" weight="700">
                    Ghi nhận hư hỏng/phí phát sinh
                  </Text>
                  <Text className="mt-1 text-[11px] leading-4 text-slate-500">
                    Bật mục này nếu xe có hư hỏng cần khách xác nhận khi checkout.
                  </Text>
                </View>
                <Switch
                  value={damageFlagged}
                  onValueChange={setDamageFlagged}
                  trackColor={{ false: '#1e293b', true: '#f97316' }}
                  thumbColor="#ffffff"
                />
              </View>

              {damageFlagged ? (
                <View className="gap-3">
                  <TextInput
                    value={damageDescription}
                    onChangeText={setDamageDescription}
                    multiline
                    placeholder="Mô tả hư hỏng, vị trí, mức độ..."
                    placeholderTextColor="#64748b"
                    className="min-h-[92px] rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-[12px] text-white"
                    style={{ textAlignVertical: 'top' }}
                  />
                  <View className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <Text className="text-[10px] uppercase tracking-wider text-slate-500" weight="700">
                      Chi phí dự kiến
                    </Text>
                    <TextInput
                      value={estimatedCostText}
                      onChangeText={(value) => setEstimatedCostText(value.replace(/[^\d]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#475569"
                      className="mt-2 h-11 rounded-lg border border-slate-800 bg-[#0b0f19] px-3 text-[15px] text-white"
                    />
                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <Text className="text-[11px] text-slate-500">Hệ số xe</Text>
                      <Text className="text-[12px] text-slate-200" weight="700">
                        x{damageMultiplier}
                      </Text>
                    </View>
                    <View className="mt-2 flex-row items-center justify-between gap-3">
                      <Text className="text-[11px] text-slate-500">Dự kiến tính phí</Text>
                      <Text className="text-[13px] text-[#fb923c]" weight="700">
                        {formatCurrency(finalCharge)}
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
            className="mb-5 min-h-[96px] rounded-2xl border border-slate-800 bg-[#0f172a]/60 px-4 py-3 text-[12px] text-white"
            style={{ textAlignVertical: 'top' }}
          />

          <View className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <View className="flex-row gap-2">
              <AlertTriangle color="#f59e0b" size={16} />
              <Text className="flex-1 text-[11px] leading-4 text-amber-100/80">
                Sau khi gửi biên bản checkout, khách sẽ nhận thông báo để xem ảnh, checklist và xác nhận
                hoàn tất. Nếu khách từ chối, phiên sẽ quay lại trạng thái cần xử lý.
              </Text>
            </View>
          </View>
        </ScrollView>

        {!(isByoc && type === 'CHECK_OUT') ? (
          <View className="border-t border-slate-900 bg-[#0b0f19] px-5 py-4">
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
        ) : null}
      </KeyboardAvoidingView>
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
  onChangeNotes,
}: {
  slot: PhotoSlot;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onChangeNotes: (notes: string) => void;
}) {
  const hasPhoto = !!slot.uri || !!slot.url;

  return (
    <View className="rounded-2xl border border-slate-800 bg-[#0f172a]/60 p-4">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <View>
          <Text className="text-[13px] text-white" weight="700">
            {slot.label}
          </Text>
          <Text className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{slot.angle}</Text>
        </View>
        {slot.url ? (
          <View className="flex-row items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
            <CheckCircle2 color="#34d399" size={12} />
            <Text className="text-[9px] text-emerald-300" weight="700">
              Đã upload
            </Text>
          </View>
        ) : null}
      </View>

      <View className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        {hasPhoto ? (
          <View className="h-full w-full">
            <Image source={{ uri: slot.uri || slot.url }} className="h-full w-full" resizeMode="cover" />
            {slot.uploading ? (
              <View className="absolute inset-0 items-center justify-center bg-black/60">
                <ActivityIndicator color="#ffffff" />
                <Text className="mt-2 text-[11px] text-white" weight="700">
                  Đang nén & upload...
                </Text>
              </View>
            ) : null}
          </View>
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
