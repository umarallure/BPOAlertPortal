<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()

const open = ref(false)

const links = [[
 
{
  label: 'Score Board',
  icon: 'i-lucide-chart-bar',
  to: '/',
  onSelect: () => {
    open.value = false}
},

{
  label: 'Daily Deal Flow',
  icon: 'i-lucide-clipboard-list',
  to: '/daily-deal-flow',
  onSelect: () => {
    open.value = false
  }
},

// Dashboard - Hidden for now, uncomment when needed
// {
//   label: 'Dashboard',
//   icon: 'i-lucide-layout-dashboard',
//   to: '/dashboard',
//   onSelect: () => {
//     open.value = false
//   }
// },

// Analytics - Hidden for now, uncomment when needed
// {
//   label: 'Analytics',
//   icon: 'i-lucide-chart-line',
//   to: '/analytics',
//   onSelect: () => {
//     open.value = false
//   }
// }, 

{
  label: 'BPOs Performance',
  icon: 'i-lucide-building-2',
  to: '/bpo-centers',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Alerts',
  icon: 'i-lucide-bell',
  to: '/alerts',
  badge: '3',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Reports',
  icon: 'i-lucide-bar-chart-3',
  to: '/reports',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Settings',
  to: '/settings',
  icon: 'i-lucide-settings',
  defaultOpen: true,
  type: 'trigger',
  children: [{
    label: 'General',
    to: '/settings',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, 
  {
    label: 'BPO Thresholds',
    to: '/settings/bpo-thresholds',
    onSelect: () => {
      open.value = false
    }
  },
  {
    label: 'Alert Rules',
    to: '/settings/alert-rules',
    onSelect: () => {
      open.value = false
    }
  }
  // Integrations - Hidden for now, uncomment when needed
  // ,   
  // {
  //   label: 'Integrations',
  //   to: '/settings/integrations',
  //   onSelect: () => {
  //     open.value = false
  //   }
  // }
  
  ]
}]] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links.flat()
}, {
  id: 'code',
  label: 'Code',
  items: [{
    id: 'source',
    label: 'View page source',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
