export type WorkspaceTier = 'FREE' | 'STARTER' | 'ADVANCE' | 'ADMIN'

export interface CreditTransaction {
  id: string
  amount: number
  action_type: string
  description: string
  balance_after: number
  post_id: string | null
  created_at: string
}

export interface BillingInvoice {
  id: string
  invoice_number: string
  amount: string
  currency: string
  status: 'PAID' | 'OPEN' | 'VOID'
  title: string
  line_items?: Array<{ description: string; quantity: number; unit_price: string; total: string }>
  payment_method?: string
  paid_at: string
  download_url: string
}

export interface SubscriptionOverview {
  tier: WorkspaceTier
  role_label: string
  is_admin: boolean
  connections: {
    used: number
    limit: number
    unlimited: boolean
    extra_purchased: number
  }
  credits: {
    balance: number
    total_allocated: number
    total_used: number
    unlimited: boolean
    cost_per_draft: number
    cost_per_image: number
  }
  engage_entitled: boolean
  scheduling_unlimited: boolean
  transactions: CreditTransaction[]
  invoices: BillingInvoice[]
}

export interface CheckoutPayload {
  action: 'UPGRADE_PLAN' | 'BUY_BOOSTER' | 'ADD_CONNECTIONS' | 'ADD_ENGAGE'
  tier?: 'STARTER' | 'ADVANCE'
  booster_credits?: number
  extra_connections?: number
  has_engage?: boolean
  billing_name?: string
  billing_email?: string
  payment_method?: string
}

export interface CheckoutResponse {
  success: boolean
  message: string
  invoice: BillingInvoice
  tier: WorkspaceTier
  credit_balance: number
  connections_limit: number
  engage_entitled: boolean
}
