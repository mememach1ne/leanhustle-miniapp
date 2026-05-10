export interface BusinessSettingsDto {
  id: string;
  cnyToUsd: number;
  cnyToRub: number;
  eurToRub: number;
  commissionPercent: number;
  deliveryPricePerKgRub: number;
  dutyThresholdEur: number;
  dutyPercent: number;
  dutyProcessingFeeRub: number;
  updatedAt: string;
}

export interface UpdateBusinessSettingsRequest {
  cnyToUsd?: number;
  cnyToRub?: number;
  eurToRub?: number;
  commissionPercent?: number;
  deliveryPricePerKgRub?: number;
}

export interface SettingsAuditActorDto {
  id: string;
  role: 'admin' | 'manager';
  telegramId?: string | null;
  username?: string | null;
}

export interface SettingsAuditLogItemDto {
  id: string;
  changedFields: string[];
  previousValues?: Record<string, number> | null;
  nextValues: Record<string, number>;
  createdAt: string;
  changedByStaff?: SettingsAuditActorDto | null;
}
