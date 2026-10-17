/** Carriers of the RF leg. "raketa" = the forwarder's own pickup points (Far East); never shown by that name. */
export type DeliveryCarrier = 'cdek' | 'pochta' | 'raketa';
/** Pickup point (СДЭК / post office / partner point) or a courier to the door. */
export type DeliveryKind = 'pvz' | 'courier';

/** Client-facing carrier names (the forwarder's own points are a «partner» point). */
export const DELIVERY_CARRIER_LABELS: Record<DeliveryCarrier, string> = {
  cdek: 'СДЭК',
  pochta: 'Почта России',
  raketa: 'Пункт выдачи партнёра',
};

/** Door address for courier delivery (street + house come from the address directory). */
export interface DeliveryCourierAddress {
  /** "ул Тверская, д 13" — as the directory returned it. */
  fullAddress: string;
  street: string;
  house: string;
  /** Postal index of the house — the courier checks it. */
  index: string;
  apartment?: string | null;
  entrance?: string | null;
  floor?: string | null;
  intercom?: string | null;
  /** A private house: no flat/entrance/floor. */
  privateHouse?: boolean;
}

/**
 * Where the parcel goes, picked from the directory (absent on old free-text
 * addresses): a pickup point of a carrier, or a door address for a courier.
 */
export interface DeliveryPickupPoint {
  /** RAKETA/FIAS city id. */
  cityId: string;
  city: string;
  region?: string | null;
  /** Default: "pvz". */
  kind?: DeliveryKind;
  /** Carrier of the pickup point (default "cdek"); a courier's carrier is chosen at checkout. */
  carrier?: DeliveryCarrier;
  /** Pickup point code (CDEK "MSK1005", post office index…); empty for a courier. */
  pvzCode: string;
  pvzIndex?: string | null;
  /** Door address — kind "courier" only. */
  courier?: DeliveryCourierAddress | null;
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

/** Which ways of receiving exist in a city. */
export interface DeliveryCityOptionsDto {
  /** Carriers with pickup points here. */
  pvz: DeliveryCarrier[];
  /** Courier to the door is possible. */
  courier: boolean;
}

/** House suggestion for a courier address. */
export interface DeliveryStreetSuggestionDto {
  fullAddress: string;
  street: string;
  house: string;
  index: string;
}

/** Pickup point (CDEK / post office / partner) from the delivery directory. */
export interface DeliveryPointDto {
  code: string;
  address: string;
  workTime: string | null;
  index: string | null;
  /** "lat,lon" */
  gps: string | null;
}
