// User type placeholder
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string;
  referralBonusAmount: number;
  // isVerified: boolean; // KYC removed
  // kycStatus: 'unverified' | 'pending' | 'verified'; // KYC removed
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  circleIds: string[];
  bankAccounts: BankAccount[];
  onboardingComplete: boolean;
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
