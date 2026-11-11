'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.META_API_VERSION || 'v25.0';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(v => v.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    // Requests from PowerShell/curl have no Origin header; the test route is separately protected.
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-test-key']
}));
app.use(express.json({ limit: '30kb' }));

function cleanText(value, max = 500) {
  return String(value ?? '').trim()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, max);
}
function digits(value) { return String(value ?? '').replace(/\D/g, ''); }
function money(value) { return `${Number(value).toFixed(2)} EGP`; }
function getWhatsAppConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    recipient: digits(process.env.WHATSAPP_TO)
  };
}
function isConfigured(config) {
  return Boolean(config.token && config.phoneNumberId && config.recipient);
}
function safeKeyMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function sendTemplate({ token, phoneNumberId, recipient, name, language, components }) {
  const endpoint = `https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: { name, language: { code: language }, ...(components ? { components } : {}) }
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.messages?.[0]?.id) {
    const message = cleanText(data?.error?.error_user_msg || data?.error?.message, 300);
    const error = new Error(message || `Meta API returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data.messages[0].id;
}

app.get('/', (_req, res) => res.json({ service: 'laroz-order-api', status: 'online' }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'laroz-order-api' }));

// Manual, protected test only. It sends Meta's pre-approved hello_world template.
// It is NOT called automatically by customer checkout and never sends order details.
let lastHelloTestAt = 0;
const helloCooldownMs = Math.max(30000, Number(process.env.HELLO_TEST_COOLDOWN_MS || 60000));
app.post('/api/test/hello-world', async (req, res) => {
  const expectedKey = process.env.TEST_ENDPOINT_KEY;
  if (!safeKeyMatch(req.get('x-test-key'), expectedKey)) {
    return res.status(401).json({ success: false, message: 'مفتاح الاختبار غير صحيح.' });
  }

  const config = getWhatsAppConfig();
  if (!isConfigured(config)) {
    return res.status(503).json({ success: false, message: 'إعدادات WhatsApp غير مكتملة على Render.' });
  }

  const remaining = helloCooldownMs - (Date.now() - lastHelloTestAt);
  if (remaining > 0) {
    return res.status(429).json({
      success: false,
      retryAfterSeconds: Math.ceil(remaining / 1000),
      message: `استنى ${Math.ceil(remaining / 1000)} ثانية قبل اختبار تاني.`
    });
  }

  // Reserve the cooldown before contacting Meta, to prevent rapid repeated attempts.
  lastHelloTestAt = Date.now();
  try {
    const messageId = await sendTemplate({
      ...config,
      name: 'hello_world',
      language: 'en_US'
    });
    return res.status(200).json({
      success: true,
      template: 'hello_world',
      messageId,
      message: 'Meta قبلت رسالة الاختبار. راجع WhatsApp على رقم الاستقبال.'
    });
  } catch (error) {
    console.error('hello_world test failed:', cleanText(error.message, 200));
    return res.status(502).json({
      success: false,
      message: 'Meta لم تقبل رسالة الاختبار. راجع إعدادات الرقم والـ Token والمستلم في Render.'
    });
  }
});

// Customer orders are intentionally disabled until laroz_new_order is Approved
// and the owner explicitly enables order sending in Render.
app.post('/api/orders', async (req, res) => {
  if (process.env.ENABLE_ORDER_SENDING !== 'true') {
    return res.status(503).json({
      success: false,
      code: 'ORDER_SENDING_DISABLED',
      message: 'استقبال الطلبات الحقيقية غير مفعّل حاليًا. بنجهز الربط لحين موافقة قالب الطلب.'
    });
  }

  const config = getWhatsAppConfig();
  if (!isConfigured(config)) {
    return res.status(503).json({ success: false, message: 'إعدادات WhatsApp على السيرفر غير مكتملة.' });
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'laroz_new_order';
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const body = req.body || {};
  const orderId = cleanText(body.orderId, 40);
  const customerName = cleanText(body.customerName, 80);
  const orderType = body.orderType === 'Delivery' ? 'Delivery' : body.orderType === 'Pickup' ? 'Pickup' : '';
  const address = orderType === 'Delivery' ? cleanText(body.deliveryAddress, 300) : '-';
  const notes = cleanText(body.notes, 300);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!/^LZ-[A-Z0-9-]{5,40}$/.test(orderId) || !customerName || !orderType || (orderType === 'Delivery' && !address) || items.length < 1 || items.length > 40) {
    return res.status(400).json({ success: false, message: 'بيانات الطلب ناقصة أو غير صحيحة. راجع البيانات وحاول تاني.' });
  }

  let computedTotal = 0;
  const itemLines = [];
  for (const item of items) {
    const name = cleanText(item?.name, 80);
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);
    if (!name || !Number.isInteger(quantity) || quantity < 1 || quantity > 50 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000) {
      return res.status(400).json({ success: false, message: 'فيه صنف أو كمية غير صحيحة في الطلب.' });
    }
    computedTotal += quantity * unitPrice;
    itemLines.push(`${quantity}x ${name}`);
  }
  const suppliedTotal = Number(body.total);
  if (!Number.isFinite(suppliedTotal) || Math.abs(suppliedTotal - computedTotal) > 0.01) {
    return res.status(400).json({ success: false, message: 'إجمالي الطلب غير متطابق. حدّث السلة وحاول تاني.' });
  }

  const parameters = [
    orderId,
    customerName,
    orderType,
    itemLines.join(', ').slice(0, 900),
    money(computedTotal),
    address || '-',
    (notes || 'No notes').slice(0, 900)
  ].map(value => ({ type: 'text', text: String(value || '-') }));

  try {
    const messageId = await sendTemplate({
      ...config,
      name: templateName,
      language,
      components: [{ type: 'body', parameters }]
    });
    return res.status(200).json({ success: true, orderId, messageId });
  } catch (error) {
    console.error('Meta WhatsApp API rejected order:', cleanText(error.message, 200));
    return res.status(502).json({ success: false, message: 'Meta لم تقبل إرسال الطلب. راجع حالة القالب وإعدادات WhatsApp وحاول تاني.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'المصدر ده غير مسموح له بالاتصال بالسيرفر.' });
  }
  console.error('Request error:', cleanText(error.message, 200));
  return res.status(400).json({ success: false, message: 'تعذر معالجة الطلب.' });
});

app.listen(PORT, () => console.log(`Laroz API listening on port ${PORT}`));
