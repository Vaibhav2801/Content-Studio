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
  can_manage_billing: boolean
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
  product_id: BillingProductId
  billing_name?: string
  billing_email?: string
}

export type BillingProductId =
  | 'plan_starter_monthly'
  | 'plan_advance_monthly'
  | 'booster_50'
  | 'booster_150'
  | 'booster_350'
  | 'connection_1_monthly'
  | 'engage_monthly'

export interface PricingPlan {
  id: 'free' | 'starter' | 'advance'
  name: string
  product_id: BillingProductId | null
  price: number
  credits: number
  connections: number
  engage: boolean
}

export interface PricingAddon {
  product_id: BillingProductId
  kind: 'booster' | 'connection' | 'engage'
  amount: string
  credits?: number
  connections?: number
  title: string
}

export interface PricingCatalog {
  currency: 'USD'
  credit_costs: { draft: number; image: number; image_regeneration: number }
  plans: PricingPlan[]
  addons: PricingAddon[]
  simulated_checkout_enabled: boolean
  simulated_checkout_status?: 'enabled' | 'disabled' | 'authentication_required' | 'email_not_allowlisted'
}

export interface CheckoutResponse {
  success: boolean
  message?: string
  invoice: BillingInvoice
  tier: WorkspaceTier
  credit_balance: number
  connections_limit: number
  engage_entitled: boolean
}
