import type { DewuApiRawProductResponse } from '../services/dewu-api-client.service';

/**
 * Demo product returned to allow-listed users (owner + investor) while the
 * paid Poizon/Dewu API is unavailable. Shaped exactly like the real gateway
 * response so it flows through the normal mapper + pricing untouched.
 *
 * Only the fields the mapper reads are kept per SKU (dwSkuId, minBidPrice,
 * saleAttr). Sizes 42 and 43 carry a real minBidPrice so they show as
 * available; the rest are out of stock, exactly like a real listing.
 */
export const DEMO_PRODUCT_FIXTURE: DewuApiRawProductResponse = {
  code: 200,
  msg: 'success',
  data: {
    dwSpuId: 2827430,
    dwSpuTitle: 'LOUIS VUITTON Waterfront 舒适轻便一字拖鞋 男款 绿色',
    distSpuTitle: "LOUIS VUITTON Waterfront Slide Slippers Men's Green",
    image:
      'https://cdn.poizon.com/pro-img/origin-img/20230805/c635347222414b38851b9c4cc73ed67c.jpg',
    baseImage: [
      'https://cdn.poizon.com/pro-img/origin-img/20230805/c635347222414b38851b9c4cc73ed67c.jpg',
      'https://cdn.poizon.com/pro-img/origin-img/20230805/419af27cca8945b1a702a640c0bedcef.jpg',
      'https://cdn.poizon.com/pro-img/origin-img/20230805/9027823449504fe193c9a2980f29168d.jpg',
      'https://cdn.poizon.com/pro-img/origin-img/20240223/7a940ac68dfd42e88050db8e1ca25764.jpg',
    ],
    distBrandName: 'LOUIS VUITTON',
    distCategoryl1Name: 'Shoes',
    distCategoryl2Name: 'Sandals / Slippers',
    distCategoryl3Name: 'Slide Slippers',
    sizeChart:
      'https://cdn.poizon.com/trade/gondor/10278765/20240411-d0d25e4fc0418cb0-w1440h2889.jpeg',
    skuList: [
      buildSku(611442181, 0, 'Shoe Box Included', '有鞋盒', '40'),
      buildSku(611442183, 0, 'Shoe Box Included', '有鞋盒', '41'),
      buildSku(611442185, 599700, 'Shoe Box Included', '有鞋盒', '42'),
      buildSku(611442187, 659700, 'Shoe Box Included', '有鞋盒', '43'),
      buildSku(611442189, 0, 'Shoe Box Included', '有鞋盒', '44'),
      buildSku(611442191, 0, 'Shoe Box Included', '有鞋盒', '45'),
      buildSku(611442193, 0, 'Shoe Box Included', '有鞋盒', '46'),
      buildSku(678713589, 0, 'Shoe Box Not Included', '无鞋盒', '42'),
      buildSku(678713591, 0, 'Shoe Box Not Included', '无鞋盒', '43'),
    ],
  },
};

function buildSku(
  dwSkuId: number,
  minBidPrice: number,
  versionEn: string,
  versionCn: string,
  size: string,
) {
  return {
    dwSkuId,
    minBidPrice,
    saleAttr: [
      { enName: 'Version', enValue: versionEn, cnName: '版本', cnValue: versionCn },
      { enName: 'Size', enValue: size, cnName: '尺码', cnValue: size },
    ],
  };
}
