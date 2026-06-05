// ─── Platform Settings Types ──────────────────────────────────────────────────

export interface WalletSettings {
  minDepositKobo: number;
  maxDepositKobo: number;
  minWithdrawKobo: number;
  maxWithdrawKobo: number;
  withdrawFeeFlatKobo: number;
  withdrawFeePercent: number;
  withdrawFeeCapKobo: number;
  maxWalletBalanceKobo: number;
}

export interface CircleSettings {
  maxActiveCirclesPerUser: number;
  minContributionKobo: number;
  maxContributionKobo: number;
  minCircleMembers: number;
  maxCircleMembers: number;
  creationFeePercent: number;
  latePenaltyPercent: number;
  latePenaltySplitEnabled: boolean;
  latePenaltyCircleAdminSharePercent: number;
  gracePeriodHours: number;
  consecutiveMissedLimit: number;
  bidCloseHoursBeforePayout: number;

  // ─── Join fee abuse protection ─────────────────────────────────────────────
  /**
   * Maximum join fee expressed as a percentage of the circle's per-cycle
   * contribution. E.g. 50 means the join fee can be at most 50% of the
   * contribution amount.
   *
   * This is the primary anti-abuse control because it ties the fee to the
   * value a member actually gets from the circle. A circle charging ₦5,000
   * contribution cannot charge more than ₦2,500 join fee at 50%.
   *
   * Default: 50 (%)
   */
  maxJoinFeePercent: number;

  /**
   * Absolute hard cap on join fee in kobo, regardless of contribution size.
   * Prevents high-contribution circles from charging enormous join fees.
   *
   * The effective cap is: min(contribution × maxJoinFeePercent/100, maxJoinFeeKobo)
   *
   * Default: ₦5,000 (500_000 kobo)
   */
  maxJoinFeeKobo: number;
}

export interface PayoutSettings {
  platformPayoutFeePercent: number;
  kycRequiredAboveKobo: number;
  referralBonusKobo: number;
  referralMinDepositKobo: number;
  referralMonthlyLimit: number;
  settlementPeriodHours: number;
}

export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  logoUrl?: string;
  supportEmail: string;
  supportPhone?: string;
  timezone: string;
  currency: string;
  defaultLocale: string;
  platformIpAddress?: string;
}

export interface InvestmentSettings {
  platformInterestFeePercent: number;
  earlyWithdrawalEnabled: boolean;
}

export interface TrustScoreSettings {
  onTimePaymentWeight: number;
  latePaymentWeight: number;
  missedPaymentWeight: number;
}

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsProviderName: string;
  emailProviderName: string;
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

// ─── Default values ────────────────────────────────────────────────────────────

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
    // Join fee protection defaults
    maxJoinFeePercent: 50,    // Join fee ≤ 50% of the per-cycle contribution
    maxJoinFeeKobo: 500_000,  // Hard cap: ₦5,000
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