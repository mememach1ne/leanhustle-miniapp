/** CDEK pickup point chosen from the directory (absent on old free-text addresses). */
export interface DeliveryPickupPoint {
  /** RAKETA/FIAS city id. */
  cityId: string;
  city: string;
  region?: string | null;
  /** CDEK pickup point code, e.g. "MSK1005". */
  pvzCode: string;
  pvzIndex?: string | null;
}

export interface DeliveryAddressDto {
  id: string;
  fullName: string;
  cdekAddress: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  pickupPoint: DeliveryPickupPoint | null;
}

export interface CreateDeliveryAddressRequest {
  fullName: string;
  cdekAddress: string;
  phone: string;
  isDefault?: boolean;
  pickupPoint?: DeliveryPickupPoint;
}

export interface UpdateDeliveryAddressRequest {
  fullName?: string;
  cdekAddress?: string;
  phone?: string;
  isDefault?: boolean;
  pickupPoint?: DeliveryPickupPoint;
}

/** City from the delivery directory. */
export interface DeliveryCityDto {
  id: string;
  city: string;
  region: string | null;
}

/** CDEK pickup point from the delivery directory. */
export interface DeliveryPointDto {
  code: string;
  address: string;
  workTime: string | null;
  index: string | null;
  /** "lat,lon" */
  gps: string | null;
}
