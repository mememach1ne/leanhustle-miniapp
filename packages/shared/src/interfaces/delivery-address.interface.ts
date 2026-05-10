export interface DeliveryAddressDto {
  id: string;
  fullName: string;
  cdekAddress: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateDeliveryAddressRequest {
  fullName: string;
  cdekAddress: string;
  phone: string;
  isDefault?: boolean;
}

export interface UpdateDeliveryAddressRequest {
  fullName?: string;
  cdekAddress?: string;
  phone?: string;
  isDefault?: boolean;
}
