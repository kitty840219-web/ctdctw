import { md5 } from './md5.js';

// ECPay's CheckMacValue algorithm is defined against .NET's UrlEncode
// behaviour, not RFC3986. This is the standard JS port used across the
// Taiwan dev community (mirrors the official ecpay_aio_nodejs SDK).
function ecpayEncode(str) {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%20/g, '+');
}

export function checkMacValue(params, hashKey, hashIV) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'CheckMacValue')
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));
  const raw = `HashKey=${hashKey}&${keys.map((k) => `${k}=${params[k]}`).join('&')}&HashIV=${hashIV}`;
  return md5(ecpayEncode(raw)).toUpperCase();
}

// yyyy/MM/dd HH:mm:ss in Asia/Taipei (UTC+8), regardless of runtime TZ.
export function taipeiTradeDate(date = new Date()) {
  const t = new Date(date.getTime() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
}

export function buildCheckout(env, { orderNo, amount, itemName, notifyPath, resultPath, origin }) {
  const params = {
    MerchantID: env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: orderNo,
    MerchantTradeDate: taipeiTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(amount),
    TradeDesc: 'CTDC-shop-order',
    ItemName: itemName,
    // ReturnURL: server-to-server payment notify, must be reachable from
    // ECPay (the worker's own origin) and must respond "1|OK".
    ReturnURL: `${env.SHOP_API_ORIGIN}${notifyPath}`,
    // OrderResultURL: ECPay POSTs the browser back here after payment —
    // this is what actually shows the customer their result, unlike
    // ClientBackURL which only fires if they click ECPay's own back button.
    OrderResultURL: `${origin}${resultPath}`,
    ChoosePayment: 'ALL',
    EncryptType: '1',
  };
  params.CheckMacValue = checkMacValue(params, env.ECPAY_HASH_KEY, env.ECPAY_HASH_IV);
  const actionUrl = env.ECPAY_ENV === 'production'
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
  return { actionUrl, fields: params };
}

export function verifyNotify(env, formParams) {
  const received = formParams.CheckMacValue;
  const expected = checkMacValue(formParams, env.ECPAY_HASH_KEY, env.ECPAY_HASH_IV);
  return received && expected === received;
}
