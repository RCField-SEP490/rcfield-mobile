import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Plus, Minus, Coffee, Flame } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';
import { useColorScheme } from 'nativewind';
import {
  bookingWizardApi,
  type MenuItem,
  type PopularMenuItemEntry,
} from '../api/booking-wizard.api';

// Key được encode dưới dạng "itemId" hoặc "itemId__variantId"
function encodeKey(itemId: string, variantId?: string): string {
  return variantId ? `${itemId}__${variantId}` : itemId;
}

interface FnbStepProps {
  cafeId: string;
  fnbQuantities: Record<string, number>;
  setFnbQuantities: (quantities: Record<string, number>) => void;
}

// ─── Sub-component: Item Card ──────────────────────────────────────────────────

interface MenuItemCardProps {
  item: MenuItem;
  fnbQuantities: Record<string, number>;
  onChangeQty: (key: string, delta: number) => void;
  /** Hiển thị compact (dạng ngang) hay full (dạng dọc có variants) */
  compact?: boolean;
  orderCount?: number;
}

function MenuItemCard({ item, fnbQuantities, onChangeQty, compact, orderCount }: MenuItemCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const availableVariants = useMemo(() => {
    return item.variants?.filter((v) => v.isAvailable) ?? [];
  }, [item.variants]);

  const hasVariants = availableVariants.length > 0;

  // Tổng số lượng của món này (tất cả variants)
  const totalQty = useMemo(() => {
    let total = 0;
    // Cộng qty của món không variant
    total += fnbQuantities[item.id] ?? 0;
    // Cộng qty của tất cả variants
    for (const v of availableVariants) {
      total += fnbQuantities[encodeKey(item.id, v.id)] ?? 0;
    }
    return total;
  }, [fnbQuantities, item.id, availableVariants]);

  const formatPrice = (price: number | string) =>
    Number(price).toLocaleString('vi-VN') + 'đ';

  if (compact) {
    // ── Compact card: dùng cho section "Khách hay gọi" ──
    // Không có variant trong compact — chỉ thêm trực tiếp
    const qty = fnbQuantities[item.id] ?? 0;
    const basePrice = hasVariants
      ? `Từ ${formatPrice(availableVariants[0]?.price ?? item.price)}`
      : formatPrice(item.price);

    return (
      <View className="bg-white dark:bg-[#0f172a]/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 w-44 shadow-sm">
        {/* Ảnh */}
        <View className="h-24 w-full rounded-lg bg-slate-100 dark:bg-slate-900 mb-2.5 overflow-hidden items-center justify-center">
          {item.image ? (
            <Image source={{ uri: item.image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Coffee color="#475569" size={28} />
          )}
        </View>

        {/* Tên & giá */}
        <Text className="text-[12px] text-slate-900 dark:text-white font-bold" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-[11px] text-[#f97316] font-bold mt-0.5">{basePrice}</Text>

        {/* Social proof */}
        {orderCount !== undefined && orderCount > 0 && (
          <View className="flex-row items-center gap-0.5 mt-1">
            <Flame color="#f97316" size={9} />
            <Text className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
              {orderCount} lượt đặt gần đây
            </Text>
          </View>
        )}

        {/* Nút thêm */}
        <View className="flex-row items-center justify-end mt-2 gap-2">
          {qty > 0 && !hasVariants && (
            <>
              <Pressable
                onPress={() => onChangeQty(item.id, -1)}
                className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center active:bg-slate-200"
              >
                <Minus color={isDark ? '#fff' : '#475569'} size={12} />
              </Pressable>
              <Text className="text-[12px] text-slate-900 dark:text-white font-bold">{qty}</Text>
            </>
          )}
          {!hasVariants ? (
            <Pressable
              onPress={() => onChangeQty(item.id, 1)}
              className="h-6 w-6 rounded-full bg-[#ea580c] items-center justify-center active:bg-[#f97316]"
            >
              <Plus color="#ffffff" size={11} />
            </Pressable>
          ) : (
            <Text className="text-[9px] text-slate-400 font-semibold italic">Chọn size ↓</Text>
          )}
        </View>
      </View>
    );
  }

  // ── Full card: dạng danh sách dọc với variant rows ──
  return (
    <View
      className={`bg-white dark:bg-[#0f172a]/60 border rounded-xl overflow-hidden shadow-sm ${
        totalQty > 0
          ? 'border-[#f97316]/40 dark:border-[#f97316]/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Row đầu: ảnh + tên + giá base */}
      <View className="flex-row gap-3 items-center p-3">
        <View className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-900 overflow-hidden items-center justify-center flex-shrink-0">
          {item.image ? (
            <Image source={{ uri: item.image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Coffee color="#475569" size={22} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[13px] text-slate-900 dark:text-white font-bold" numberOfLines={2}>
            {item.name}
          </Text>
          {hasVariants ? (
            <Text className="text-[11px] text-[#f97316] mt-0.5 font-bold">
              Từ {formatPrice(availableVariants[0]?.price ?? item.price)}
            </Text>
          ) : (
            <Text className="text-[12px] text-[#f97316] mt-0.5 font-bold">
              {formatPrice(item.price)}
            </Text>
          )}
        </View>

        {/* Qty adjuster cho món không có variant */}
        {!hasVariants && (
          <View className="flex-row items-center gap-2">
            {(fnbQuantities[item.id] ?? 0) > 0 && (
              <>
                <Pressable
                  onPress={() => onChangeQty(item.id, -1)}
                  className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center active:bg-slate-200 dark:active:bg-slate-700"
                >
                  <Minus color={isDark ? '#fff' : '#475569'} size={14} />
                </Pressable>
                <Text className="text-[13px] text-slate-900 dark:text-white font-bold w-5 text-center">
                  {fnbQuantities[item.id] ?? 0}
                </Text>
              </>
            )}
            <Pressable
              onPress={() => onChangeQty(item.id, 1)}
              className="h-7 w-7 rounded-full bg-[#ea580c] items-center justify-center active:bg-[#f97316]"
            >
              <Plus color="#ffffff" size={14} />
            </Pressable>
          </View>
        )}
      </View>

      {/* Variant rows (size M / L / ...) */}
      {hasVariants && (
        <View className="border-t border-slate-100 dark:border-slate-800/80 px-3 pb-3">
          {availableVariants.map((variant) => {
            const key = encodeKey(item.id, variant.id);
            const qty = fnbQuantities[key] ?? 0;
            return (
              <View key={variant.id} className="flex-row items-center justify-between mt-2.5">
                <View className="flex-row items-center gap-2">
                  <View className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                  <Text className="text-[12px] text-slate-600 dark:text-slate-300 font-semibold">
                    {variant.name} · {formatPrice(variant.price)}
                  </Text>
                </View>
                {/* Wrapper cố định h-6 để card không bị co giãn khi đổi trạng thái */}
                <View className="flex-row items-center justify-end gap-2 h-6">
                  {qty > 0 ? (
                    <>
                      <Pressable
                        onPress={() => onChangeQty(key, -1)}
                        className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center active:bg-slate-200 dark:active:bg-slate-700"
                      >
                        <Minus color={isDark ? '#fff' : '#475569'} size={12} />
                      </Pressable>
                      <Text className="text-[12px] text-slate-900 dark:text-white font-bold w-4 text-center">
                        {qty}
                      </Text>
                    </>
                  ) : null}
                  <Pressable
                    onPress={() => onChangeQty(key, 1)}
                    className="h-6 w-6 rounded-full bg-[#ea580c] items-center justify-center active:bg-[#f97316]"
                  >
                    <Plus color="#ffffff" size={12} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main FnbStep ──────────────────────────────────────────────────────────────

export function FnbStep({ cafeId, fnbQuantities, setFnbQuantities }: FnbStepProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [popularEntries, setPopularEntries] = useState<PopularMenuItemEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [items, popular] = await Promise.all([
        bookingWizardApi.getCafeMenu(cafeId),
        bookingWizardApi.getCafeMenuPopular(cafeId),
      ]);
      setMenuItems(items);
      setPopularEntries(popular);
      setLoading(false);
    };
    fetchAll();
  }, [cafeId]);

  const handleQuantityChange = (key: string, delta: number) => {
    const currentQty = fnbQuantities[key] || 0;
    const newQty = Math.max(0, currentQty + delta);
    const updated = { ...fnbQuantities };
    if (newQty === 0) {
      delete updated[key];
    } else {
      updated[key] = newQty;
    }
    setFnbQuantities(updated);
  };

  // Danh sách popular items đã khớp với data menu
  const popularItems = useMemo(() => {
    const byId = new Map(menuItems.map((m) => [m.id, m]));
    return popularEntries
      .map((e) => ({ item: byId.get(e.menuItemId), orderCount: e.orderCount }))
      .filter((e): e is { item: MenuItem; orderCount: number } => e.item !== undefined);
  }, [menuItems, popularEntries]);

  // Nhóm menu theo categoryName
  const groupedMenu = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const cat = item.categoryName ?? 'Chưa phân loại';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    return groups;
  }, [menuItems]);

  return (
    <View className="space-y-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-1.5">
          <Coffee color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">
            Đặt trước F&B
          </Text>
        </View>
        <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
          Không bắt buộc
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#f97316" className="py-8" />
      ) : menuItems.length === 0 ? (
        <View className="bg-slate-100 dark:bg-slate-900/30 rounded-xl p-6 border border-dashed border-slate-200 dark:border-slate-800 items-center justify-center">
          <Text className="text-[12px] text-slate-500 dark:text-slate-400 font-semibold">
            Không có món F&B khả dụng tại cơ sở này.
          </Text>
        </View>
      ) : (
        <View className="gap-5">
          {/* Section: Khách hay gọi */}
          {popularItems.length > 0 && (
            <View>
              <View className="flex-row items-center gap-1.5 mb-2.5">
                <Flame color="#f97316" size={13} />
                <Text className="text-[11px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                  Khách ở đây hay gọi
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingRight: 4 }}
              >
                {popularItems.map(({ item, orderCount }) => (
                  <MenuItemCard
                    key={`popular-${item.id}`}
                    item={item}
                    fnbQuantities={fnbQuantities}
                    onChangeQty={handleQuantityChange}
                    compact
                    orderCount={orderCount}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section: Danh sách đầy đủ theo nhóm */}
          {[...groupedMenu.entries()].map(([categoryName, items]) => (
            <View key={categoryName}>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">
                {categoryName}
              </Text>
              <View className="gap-2.5">
                {items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    fnbQuantities={fnbQuantities}
                    onChangeQty={handleQuantityChange}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* Note */}
          <Text className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-4 text-center">
            Không bắt buộc — bạn vẫn có thể gọi thêm tại quán, nhưng sẽ phải chờ pha chế.
          </Text>
        </View>
      )}
    </View>
  );
}
