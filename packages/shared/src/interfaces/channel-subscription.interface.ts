import type { UserProfile } from './user-profile.interface';
import { SubscriptionVerificationStatus } from '../enums/subscription-verification-status.enum';

export interface ChannelSubscriptionRefreshResponse {
  user: UserProfile;
  verificationStatus: SubscriptionVerificationStatus;
  message?: string;
}
