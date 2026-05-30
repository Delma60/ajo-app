// Wallet type placeholder
export interface Wallet {
  userId: string;
  available: number;
  pending: number;
  totalSaved: number;
  totalReceived: number;
  referralEarnings: number;
  currency: 'NGN';
  updatedAt: any;
}
