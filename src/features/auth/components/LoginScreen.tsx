import { useRouter } from 'expo-router';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginSchema } from '@/shared/schemas/auth';
import { useAuthStore } from '@/shared/store/auth-store';
import { Text } from '@/shared/ui/Text';

interface FieldErrors {
  email?: string;
  form?: string;
  password?: string;
}

export function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = async () => {
    const parsed = loginSchema.safeParse({ email: email.trim(), password });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      await login(parsed.data);
      router.replace('/(tabs)');
    } catch {
      setErrors({
        form: 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.',
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#fcf8f8]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-5 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-6">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-lg border border-[#ffdbca] bg-[#fff3eb]">
              <ShieldCheck color="#ea580c" size={24} strokeWidth={2.4} />
            </View>
            <Text className="text-[#1c1b1b]" variant="title" weight="700">
              Đăng nhập RCField
            </Text>
            <Text className="mt-2 text-[14px] leading-5 text-[#6b7280]" weight="500">
              Truy cập lịch đặt sân và công cụ vận hành theo vai trò của bạn.
            </Text>
          </View>

          <View className="rounded-lg border border-[#e5e2e1] bg-white p-4">
            <View className="gap-4">
              <View>
                <Text className="mb-1.5 text-[12px] uppercase text-[#4c4a49]" weight="700">
                  Email
                </Text>
                <View className="h-12 flex-row items-center rounded-lg border border-[#e5e2e1] bg-white px-3">
                  <Mail color="#6b7280" size={18} strokeWidth={2.2} />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    className="ml-2 flex-1 text-[14px] font-semibold text-[#1c1b1b]"
                    editable={!isLoading}
                    keyboardType="email-address"
                    onChangeText={(value) => {
                      setEmail(value);
                      if (errors.email || errors.form) {
                        setErrors((current) => ({ ...current, email: undefined, form: undefined }));
                      }
                    }}
                    placeholder="email@example.com"
                    placeholderTextColor="#a09e9d"
                    value={email}
                  />
                </View>
                {errors.email ? (
                  <Text className="mt-1.5 text-[12px] text-[#e11d48]" weight="600">
                    {errors.email}
                  </Text>
                ) : null}
              </View>

              <View>
                <Text className="mb-1.5 text-[12px] uppercase text-[#4c4a49]" weight="700">
                  Mật khẩu
                </Text>
                <View className="h-12 flex-row items-center rounded-lg border border-[#e5e2e1] bg-white px-3">
                  <LockKeyhole color="#6b7280" size={18} strokeWidth={2.2} />
                  <TextInput
                    autoCapitalize="none"
                    className="ml-2 flex-1 text-[14px] font-semibold text-[#1c1b1b]"
                    editable={!isLoading}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (errors.password || errors.form) {
                        setErrors((current) => ({
                          ...current,
                          form: undefined,
                          password: undefined,
                        }));
                      }
                    }}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="#a09e9d"
                    secureTextEntry
                    value={password}
                  />
                </View>
                {errors.password ? (
                  <Text className="mt-1.5 text-[12px] text-[#e11d48]" weight="600">
                    {errors.password}
                  </Text>
                ) : null}
              </View>

              {errors.form ? (
                <View className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2">
                  <Text className="text-[12px] leading-5 text-[#e11d48]" weight="600">
                    {errors.form}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                className="h-12 items-center justify-center rounded-lg bg-[#ea580c] disabled:opacity-60"
                disabled={isLoading}
                onPress={() => void handleSubmit()}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-[14px] text-white" weight="700">
                    Đăng nhập
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
