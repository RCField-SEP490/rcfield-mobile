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
    <View className="w-full bg-[#0f172a]/40 border border-slate-800/80 rounded-2xl p-5 mb-5">
      {/* Title */}
      <View className="mb-5">
        <Text className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
          RCField Checkout
        </Text>
        <Text className="text-[18px] text-white mt-0.5" weight="700">
          Hoàn tất đặt lịch chạy RC
        </Text>
      </View>

      {/* Stepper progress */}
      <View className="flex-row items-center justify-between relative px-2">
        {/* Lines Background */}
        <View className="absolute top-[17px] left-8 right-8 h-[2px] bg-slate-800 z-0" />
        
        {/* Active Line Progress */}
        <View 
          className="absolute top-[17px] left-8 h-[2px] bg-[#f97316] z-0 transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (STEPS.length - 1)) * 90}%`
          }}
        />

        {STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const IconComponent = step.Icon;

          return (
            <View key={step.id} className="items-center z-10 flex-1">
              {/* Step Node */}
              <View
                className={`h-9.5 w-9.5 rounded-full items-center justify-center border transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#ea580c] border-[#ea580c]'
                    : isActive
                    ? 'bg-[#0b0f19] border-[#f97316] shadow-md shadow-[#f97316]/20'
                    : 'bg-[#0b0f19] border-slate-800'
                }`}
              >
                {isCompleted ? (
                  <Check color="#ffffff" size={16} strokeWidth={3} />
                ) : (
                  <IconComponent
                    color={isActive ? '#f97316' : '#64748b'}
                    size={16}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                )}
              </View>

              {/* Step Labels */}
              <Text
                className={`text-[10.5px] mt-2.5 text-center font-bold ${
                  isActive ? 'text-[#f97316]' : 'text-slate-400'
                }`}
              >
                {step.label}
              </Text>
              <Text className="text-[8px] text-slate-500 font-semibold mt-0.5">
                {step.sub}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
