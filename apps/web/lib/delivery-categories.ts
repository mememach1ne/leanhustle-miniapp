import {
  DELIVERY_CATEGORY_GROUPS,
  DELIVERY_CATEGORY_LABELS,
  type DeliveryCategoryGroup,
  getDeliveryCategoryLabel,
} from '@lean-poizon/shared';

export {
  DELIVERY_CATEGORY_GROUPS,
  DELIVERY_CATEGORY_LABELS,
  getDeliveryCategoryLabel,
};

/** @deprecated use DeliveryCategoryGroup from @lean-poizon/shared */
export type CategoryGroup = DeliveryCategoryGroup;

/** @deprecated use DELIVERY_CATEGORY_GROUPS from @lean-poizon/shared */
export const CATEGORY_GROUPS = DELIVERY_CATEGORY_GROUPS;
