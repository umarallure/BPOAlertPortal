<script setup lang="ts">
definePageMeta({
  layout: false
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const router = useRouter()
const supabase = useSupabaseClient()
const { role, refresh: refreshRole } = useAccessRole()

const handleLogin = async () => {
  if (!email.value || !password.value) {
    error.value = 'Please enter email and password'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (authError) {
      error.value = authError.message
      return
    }

    if (data.user) {
      await refreshRole()
      if (role.value === 'center') {
        router.push('/daily-deal-flow')
      } else {
        // Redirect to dashboard
        router.push('/')
      }
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred during login'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            BPO Alert Portal
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Admin Dashboard
          </p>
        </div>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4 text-center">
        <UFormField label="Email" name="email" required class="text-center">
          <UInput
            v-model="email"
            type="email"
            placeholder="admin@example.com"
            icon="i-lucide-mail"
            size="lg"
            class="w-full max-w-md mx-auto text-center"
            :disabled="loading"
          />
        </UFormField>

        <UFormField label="Password" name="password" required class="text-center">
          <UInput
            v-model="password"
            type="password"
            placeholder="Enter your password"
            icon="i-lucide-lock"
            size="lg"
            class="w-full max-w-md mx-auto text-center"
            :disabled="loading"
          />
        </UFormField>

        <UAlert
          v-if="error"
          icon="i-lucide-alert-circle"
          color="error"
          variant="soft"
          :title="error"
          :close-button="{ icon: 'i-lucide-x', color: 'error', variant: 'link' }"
          @close="error = ''"
        />

        <UButton
          type="submit"
          size="lg"
          block
          :loading="loading"
          :disabled="loading"
        >
          Sign In
        </UButton>
      </form>

      <template #footer>
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Insurance Sales Alert Portal v1.0</p>
          <p class="mt-1">Admin Access Only</p>
        </div>
      </template>
    </UCard>
  </div>
</template>
