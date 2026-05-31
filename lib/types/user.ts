// User type
export interface NotificationPrefs {
  // In-app
  inApp_contributionDue: boolean;
  inApp_payoutReceived: boolean;
  inApp_memberJoined: boolean;
  inApp_penaltyApplied: boolean;
  // SMS
  sms_contributionDue: boolean;
  sms_payoutReceived: boolean;
  sms_lateWarning: boolean;
  // Email
  email_contributionReceipt: boolean;
  email_payoutNotice: boolean;
  email_disputeUpdates: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  inApp_contributionDue: true,
  inApp_payoutReceived: true,
  inApp_memberJoined: true,
  inApp_penaltyApplied: true,
  sms_contributionDue: true,
  sms_payoutReceived: true,
  sms_lateWarning: true,
  email_contributionReceipt: true,
  email_payoutNotice: true,
  email_disputeUpdates: true,
};

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string;
  referralBonusAmount: number;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  circleIds: string[];
  bankAccounts: BankAccount[];
  onboardingComplete: boolean;
  notificationPrefs?: NotificationPrefs;
  createdAt: any;
  updatedAt: any;
}

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}