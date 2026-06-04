// ─── Platform Settings Types ──────────────────────────────────────────────────

export interface WalletSettings {
  minDepositKobo: number;          // ₦500 default
  maxDepositKobo: number;          // ₦5,000,000 default
  minWithdrawKobo: number;         // ₦1,000 default
  maxWithdrawKobo: number;         // ₦10,00,000 default (safety limit)
  withdrawFeeFlatKobo: number;     // ₦50 flat fee
  withdrawFeePercent: number;      // 1% of amount
  withdrawFeeCapKobo: number;      // ₦500 cap
  maxWalletBalanceKobo: number;    // safety ceiling (0 = unlimited)
}

export interface CircleSettings {
  maxActiveCirclesPerUser: number; // 10 default
  minContributionKobo: number;     // ₦500 default
  maxContributionKobo: number;     // ₦1,000,000 default
  minCircleMembers: number;        // 2 default
  maxCircleMembers: number;        // 50 default
  creationFeePercent: number;      // 5% of contribution
  latePenaltyPercent: number;      // 10% of contribution
  latePenaltySplitEnabled: boolean; // whether late penalty revenue can be shared with circle admins
  latePenaltyCircleAdminSharePercent: number; // percent of late penalty paid to the circle admin
  gracePeriodHours: number;        // 48h before late
  consecutiveMissedLimit: number;  // 3 before auto-removal
  bidCloseHoursBeforePayout: number; // 24h
}

export interface PayoutSettings {
  platformPayoutFeePercent: number; // 1%
  kycRequiredAboveKobo: number;    // ₦50,000
  referralBonusKobo: number;       // ₦500 per referral
  referralMinDepositKobo: number;  // ₦1,000 qualifying deposit
  referralMonthlyLimit: number;    // 50 referrals/month cap
  settlementPeriodHours: number;   // payout settlement hold period in hours
}

export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  logoUrl?: string;
  supportEmail: string;
  supportPhone?: string;
  timezone: string;
  currency: string; // e.g. 'NGN'
  defaultLocale: string; // e.g. 'en-NG'
  platformIpAddress?: string; // optional IP address for integrations (e.g. Flutterwave)
}

export interface InvestmentSettings {
  platformInterestFeePercent: number; // 1% on interest only
  earlyWithdrawalEnabled: boolean;
}

export interface TrustScoreSettings {
  onTimePaymentWeight: number;  // +2
  latePaymentWeight: number;    // -5
  missedPaymentWeight: number;  // -15
}

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsProviderName: string; // "Termii"
  emailProviderName: string; // "Nodemailer"
}

export interface AppDistributionPlatform {
  enabled: boolean;
  version: string;
  fileName: string;
  downloadUrl: string;
  releaseNotes: string;
  lastUploadedAt: string | null;
}

export interface AppDistributionSettings {
  android: AppDistributionPlatform;
  ios: AppDistributionPlatform;
  pageMessage: string;
}

export interface MaintenanceSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowedAdminAccess: boolean;
}

export interface PlatformSettings {
  general: GeneralSettings;
  wallet: WalletSettings;
  circles: CircleSettings;
  payouts: PayoutSettings;
  investments: InvestmentSettings;
  trustScore: TrustScoreSettings;
  notifications: NotificationSettings;
  maintenance: MaintenanceSettings;
  appDistribution: AppDistributionSettings;
  updatedAt?: string;
  updatedBy?: string;
}

// ─── Default values (mirrors lib/constants.ts) ────────────────────────────────

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  general: {
    siteName: "AjoSave",
    siteDescription: "Rotational savings platform for communities.",
    siteUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    logoUrl: "",
    supportEmail: "support@ajosave.example",
    supportPhone: "",
    timezone: "Africa/Lagos",
    currency: "NGN",
    defaultLocale: "en-NG",
    platformIpAddress: "",
  },
  wallet: {
    minDepositKobo: 50_000,
    maxDepositKobo: 500_000_000,
    minWithdrawKobo: 100_000,
    maxWithdrawKobo: 100_000_000,
    withdrawFeeFlatKobo: 5_000,
    withdrawFeePercent: 1,
    withdrawFeeCapKobo: 50_000,
    maxWalletBalanceKobo: 0,
  },
  circles: {
    maxActiveCirclesPerUser: 10,
    minContributionKobo: 50_000,
    maxContributionKobo: 100_000_000,
    minCircleMembers: 2,
    maxCircleMembers: 50,
    creationFeePercent: 5,
    latePenaltyPercent: 10,
    latePenaltySplitEnabled: false,
    latePenaltyCircleAdminSharePercent: 50,
    gracePeriodHours: 48,
    consecutiveMissedLimit: 3,
    bidCloseHoursBeforePayout: 24,
  },
  payouts: {
    platformPayoutFeePercent: 1,
    kycRequiredAboveKobo: 5_000_000,
    referralBonusKobo: 50_000,
    referralMinDepositKobo: 100_000,
    referralMonthlyLimit: 50,
    settlementPeriodHours: 24,
  },
  investments: {
    platformInterestFeePercent: 1,
    earlyWithdrawalEnabled: false,
  },
  trustScore: {
    onTimePaymentWeight: 2,
    latePaymentWeight: -5,
    missedPaymentWeight: -15,
  },
  notifications: {
    smsEnabled: true,
    emailEnabled: true,
    smsProviderName: "Termii",
    emailProviderName: "Nodemailer",
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage:
      "AjoSave is currently undergoing scheduled maintenance. We'll be back shortly.",
    allowedAdminAccess: true,
  },
  appDistribution: {
    android: {
      enabled: false,
      version: "",
      fileName: "",
      downloadUrl: "",
      releaseNotes: "",
      lastUploadedAt: null,
    },
    ios: {
      enabled: false,
      version: "",
      fileName: "",
      downloadUrl: "",
      releaseNotes: "",
      lastUploadedAt: null,
    },
    pageMessage:
      "Install the latest app directly from this website. Choose the package for your device and follow the instructions.",
  },
};

// ─── Audit log entry ──────────────────────────────────────────────────────────

export interface SettingsAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  section: string;
  field: string;
  oldValue: string;
  newValue: string;
  createdAt: string;
}