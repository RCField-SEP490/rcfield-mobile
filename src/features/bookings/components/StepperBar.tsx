import React from 'react';
import { View } from 'react-native';
import { Check, Compass, Users, Coffee, CreditCard } from 'lucide-react-native';
import { Text } from '@/shared/ui/Text';

interface StepperBarProps {
  currentStep: number; // 1 | 2 | 3 | 4
}

const STEPS = [
  { id: 1, label: 'Chọn sân', sub: 'Bước 1', Icon: Compass },
  { id: 2, label: 'Người & xe', sub: 'Bước 2', Icon: Users },
  { id: 3, label: 'F&B', sub: 'Bước 3', Icon: Coffee },
  { id: 4, label: 'Thanh toán', sub: 'Bước 4', Icon: CreditCard },
];

export function StepperBar({ currentStep }: StepperBarProps) {
  return (
    <View className="w-full bg-[#0f172a]/40 border border-slate-800/80 rounded-2xl p-4.5 mb-5">
      {/* Title */}
      <View className="mb-4">
        <Text className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
          RCField Checkout
        </Text>
        <Text className="text-[17px] text-white mt-0.5" weight="700">
          Hoàn tất đặt lịch chạy RC
        </Text>
      </View>

      {/* Stepper progress */}
      <View className="w-full">
        {/* Hàng 1: Nodes tròn và Lines nối ngang đồng tâm */}
        <View className="flex-row items-center justify-between px-3 mb-2">
          {STEPS.map((step, index) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const IconComponent = step.Icon;

            return (
              <React.Fragment key={step.id}>
                {/* Node hình tròn */}
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    backgroundColor: isCompleted ? '#ea580c' : '#0b0f19',
                    borderColor: isCompleted ? '#ea580c' : isActive ? '#f97316' : '#334155',
                    zIndex: 10,
                  }}
                >
                  {isCompleted ? (
                    <Check color="#ffffff" size={14} strokeWidth={3} />
                  ) : (
                    <IconComponent
                      color={isActive ? '#f97316' : '#475569'}
                      size={15}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  )}
                </View>

                {/* Đường nối ngang flex-1 tự động lấp đầy */}
                {index < STEPS.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      marginHorizontal: 4,
                      backgroundColor: step.id < currentStep ? '#ea580c' : '#1e293b',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Hàng 2: Nhãn chữ tương ứng thẳng cột */}
        <View className="flex-row justify-between">
          {STEPS.map((step) => {
            const isActive = step.id === currentStep;
            return (
              <View key={step.id} style={{ width: 70 }} className="items-center">
                <Text
                  className={`text-[10px] text-center font-bold leading-4 ${
                    isActive ? 'text-[#f97316]' : 'text-slate-400'
                  }`}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                <Text className="text-[7.5px] text-slate-500 font-semibold text-center mt-0.5">
                  {step.sub}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
