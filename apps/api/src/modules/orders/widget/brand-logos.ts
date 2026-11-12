/**
 * App icons of the brands shown on the order card (40×40 WebP from
 * apps/web/public/marketplaces). The widget can't load images from the
 * network and its code is capped at 4 KB, so the one logo a card needs
 * travels in its chat_data (≤ 1024 bytes).
 */
export const BRAND_LOGOS: Record<'cdek' | 'pochta' | 'poizon', string> = {
  cdek: 'data:image/webp;base64,UklGRpQBAABXRUJQVlA4IIgBAADwCQCdASooACgAPp1AnUmlo6MhLjgJmLATiWYAxQwwCc+x/jA8ICwAN5V8/8mCCE5NIa6+hIxz+G1vtJQywk8OTdg+gNVFMVttv0FH6WZEVTqOBMDFNZsAAP7J95nfSWdohjPOipWRKxhEIheYOGV3rikFH/6MHUhcSw202ZL/9n6FqHWkddn12f9DGnBFpdDmqP1urhrxx6lbYxTBSI7ZIUP6b/oY1MLNVL/MMvocZ6fAH3cJ+jan8tpt5V37JB5wtd8dfasRwOKTtVlbb6hyIhOnPEOD3Qr73Oxi5KW6sn4Kf9JjEwqjhm8ZFTQiz73QbYDYHXWMvNtkpM8Nfx80BVHVX1ZAvI2zkfXI4RP2m/imzoPur3LB7vsGtJXHLq2NySa3gL0sqA+tnAvvxuh9UK/p/fiS977JPHj1au/0U7GSC0YVfAXvtvdK4SBlkWR9O7+2jjNHF5kEB22S/kN/PN9aOBVc6HvmhatiWlUtcEC0N7c3vjE3HzYPiwx2vN5Wd4U5qAAAAA==',
  pochta: 'data:image/webp;base64,UklGRv4BAABXRUJQVlA4IPIBAABwCQCdASooACgAPrFSoUsnJSMhpzgMkOAWCWQAg/tzO7Vd5j/4EzjGAi4HmBwAHgDRgck54NbQpoZ/1IgziP7fjB4h7g6/6GgixxXgT2tLqg8l2cAA/ssH0xuoleyVNbNFXNGpsTKktdXWQ/ZJXJqYmcyss/c8u90x32lXysh2f//9CT/7l/97/f4ddZjREb//+A97fh4AKjcropbzBB7jpvq7qj5+1W2D1EQY1BRBVQlwKoqpW26YKMe8kv/qZgTQZQO795636AY17kN7FFmMQCfO7SN027l+6h3DDxl2N6jkJUdANmPyHn6JGvzYwpU+Mj6Mamr1HZ5ZZzf3VWBgB0HegkKuF8Cfq6MN1YDOGxLpa+cgbH6G592Jpdv9lFN+VfSrUDpF+uWaeMkGW+VmERrwvHpSneB0BVc1OROU+tHcvmb4QXfEGeYtunecxHwxjv8MJ3GW1COJDLuL6kuSGjvjdLTAQ5L4o7nJ56r3tmAMQJ8ZiJCr3sll+UC7rvczGIjybsgtH8D9P0iBYVmVn0mapSGInp+SShLYSBi3jjhP9vl4sk52cYQa6aZPmtPY3b72Av3NGgJmNRq5/CE21y3WXxUW/1vJsyWa/9qbcAE0cxwo2ORmCHiRWE3XjK9lYBeO21rW9ZAvTEd8pXAAAAA=',
  poizon: 'data:image/webp;base64,UklGRm4BAABXRUJQVlA4IGIBAABQCQCdASooACgAPp1InEslpCKho4z4sBOJaQAMyNequqgdyr+IF27/zPpTf5Hm/9nfVK/2O8gF2/eEf0HthsEZdAQDlWrDKfsFOOuTHxH4OZDgAAD+/ob7jhidvW3azOAIN/Zygf8a1+3d9FSb/6KbNrymv4Hu7S0J3UTKlWriv27aWbhJGamg/NtSqf/wNRNpP/5FfZ8N+PSz/z4aWTX/z3/Sgc0xS423in+GXX/15De/NrDYDRww/7J/DJPi0xkUNNHzg+SIzL/w+m7dBP1FPo7VnAP5K7N+p9VC/oXPw1kVD70Df59h8ITZx5s2ZTLL1qjgq/JuFjeetHaZfquoENaTUSUyJ/oegF7nrbdZV9/KDHmHUk6zS0+U8slLYUqq49CpWTksoeGqLIxLq+97C+knsL9g1sVRbguxNn/0FxnSZHPvQb3zetPlMOEk07Zl/oxagU5Oz1/RaZkjN5SuAAA=',
};
