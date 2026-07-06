import React, { useEffect, useState } from 'react';
import { View, Pressable, Image, ActivityIndicator } from 'react-native';
import { Plus, Minus, Coffee } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';
import { bookingWizardApi, type MenuItem } from '../api/booking-wizard.api';

interface FnbStepProps {
  cafeId: string;
  fnbQuantities: Record<string, number>;
  setFnbQuantities: (quantities: Record<string, number>) => void;
}

export function FnbStep({ cafeId, fnbQuantities, setFnbQuantities }: FnbStepProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load menu items
  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      const data = await bookingWizardApi.getCafeMenu(cafeId);
      setMenuItems(data);
      setLoading(false);
    };
    fetchMenu();
  }, [cafeId]);

  const handleQuantityChange = (itemId: string, delta: number) => {
    const currentQty = fnbQuantities[itemId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const updated = { ...fnbQuantities };
    if (newQty === 0) {
      delete updated[itemId];
    } else {
      updated[itemId] = newQty;
    }
    setFnbQuantities(updated);
  };

  return (
    <View className="space-y-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <Coffee color="#f97316" size={15} />
          <Text className="text-[13px] text-slate-400 uppercase tracking-wider font-bold">
            Đặt trước dịch vụ ăn uống (F&B)
          </Text>
        </View>
        <Text className="text-[10px] text-slate-400 font-semibold">
          Không bắt buộc
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#f97316" className="py-8" />
      ) : menuItems.length > 0 ? (
        <View className="gap-3">
          {menuItems.map((item) => {
            const qty = fnbQuantities[item.id] || 0;
            return (
              <View
                key={item.id}
                className="bg-[#0f172a]/50 border border-slate-800 rounded-xl p-3 flex-row gap-3 items-center justify-between"
              >
                <View className="flex-row gap-3 items-center flex-1 pr-2">
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      className="h-14 w-14 rounded-lg bg-slate-900 object-cover"
                    />
                  ) : (
                    <View className="h-14 w-14 rounded-lg bg-slate-900 border border-slate-800 items-center justify-center">
                      <Coffee color="#475569" size={20} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-[13px] text-white" weight="700" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-[12px] text-[#f97316] mt-1 font-bold">
                      {Number(item.price).toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                </View>

                {/* Quantity adjuster */}
                <View className="flex-row items-center gap-3">
                  {qty > 0 && (
                    <>
                      <Pressable
                        onPress={() => handleQuantityChange(item.id, -1)}
                        className="h-7 w-7 rounded-full bg-slate-800 items-center justify-center active:bg-slate-700"
                      >
                        <Minus color="#ffffff" size={14} />
                      </Pressable>
                      <Text className="text-[13px] text-white font-bold w-5 text-center">
                        {qty}
                      </Text>
                    </>
                  )}
                  <Pressable
                    onPress={() => handleQuantityChange(item.id, 1)}
                    className="h-7 w-7 rounded-full bg-[#ea580c] items-center justify-center active:bg-[#f97316]"
                  >
                    <Plus color="#ffffff" size={14} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="bg-slate-900/30 rounded-xl p-6 border border-dashed border-slate-800 items-center justify-center">
          <Text className="text-[12px] text-slate-400 font-semibold">
            Không có món F&B khả dụng tại cơ sở này.
          </Text>
        </View>
      )}
    </View>
  );
}
