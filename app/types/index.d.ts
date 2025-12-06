import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'
export type DealFlowStatus = 'Pending Approval' | 'DQ' | 'Callback' | 'Approved' | 'Rejected'
export type CallResult = 'Submitted' | 'Underwriting' | 'Not Qualified' | 'Callback Scheduled' | 'Quality Issue' | 'Failed Quality Check'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface DailyDealFlow {
  id: string
  submission_id: string
  client_phone_number: string | null
  lead_vendor: string | null
  date: string | null
  insured_name: string | null
  buffer_agent: string | null
  agent: string | null
  licensed_agent_account: string | null
  status: string | null
  call_result: string | null
  carrier: string | null
  product_type: string | null
  draft_date: string | null
  monthly_premium: number | null
  face_amount: number | null
  from_callback: boolean | null
  notes: string | null
  policy_number: string | null
  carrier_audit: string | null
  product_type_carrier: string | null
  level_or_gi: string | null
  created_at: string | null
  updated_at: string | null
  is_callback: boolean | null
  is_retention_call: boolean | null
  placement_status: string | null
  ghl_location_id: string | null
  ghl_opportunity_id: string | null
  ghlcontactid: string | null
  sync_status: string | null
  retention_agent: string | null
  retention_agent_id: string | null
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

export interface AlertRule {
  id: string
  rule_name: string
  description?: string
  rule_type: string
  priority: string
  alert_message_template: string
  condition_settings: any
  is_active: boolean
  channels: string[]
  recipients: string[]
  created_at?: string
  updated_at?: string
}
