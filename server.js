require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools and local development; restrict browser origins in production.
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '30kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'laroz-order-api' }));

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
}
function digits(value) { return String(value ?? '').replace(/\D/g, ''); }
function money(value) { return `${Number(value).toFixed(2)} EGP`; }

app.post('/api/orders', async (req, res) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const recipient = digits(process.env.WHATSAPP_TO);
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'laroz_new_order';
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const apiVersion = process.env.META_API_VERSION || 'v25.0';

  if (!token || !phoneNumberId || !recipient) {
    return res.status(503).json({ success: false, message: 'إعدادات WhatsApp على السيرفر غير مكتملة.' });
  }

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

  // The submitted Meta template has seven body parameters; parameter 7 is the Notes value.
  const itemsText = itemLines.join(', ').slice(0, 900);
  const notesText = (notes || 'No notes').slice(0, 900);
  const parameters = [
    orderId,
    customerName,
    orderType,
    itemsText,
    money(computedTotal),
    address || '-',
    notesText
  ].map(text => ({ type: 'text', text: String(text || '-') }));

  const endpoint = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`;
  try {
    const metaResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: { name: templateName, language: { code: language }, components: [{ type: 'body', parameters }] }
      }),
      signal: AbortSignal.timeout(20000)
    });
    const result = await metaResponse.json().catch(() => ({}));
    if (!metaResponse.ok || !result.messages?.[0]?.id) {
      const metaMessage = cleanText(result?.error?.error_user_msg || result?.error?.message, 300);
      console.error('Meta WhatsApp API rejected order:', metaResponse.status, metaMessage || 'No message returned');
      return res.status(502).json({ success: false, message: 'Meta لم تقبل إرسال الطلب. راجع حالة القالب وإعدادات WhatsApp وحاول تاني.' });
    }
    return res.status(200).json({ success: true, orderId, messageId: result.messages[0].id });
  } catch (error) {
    console.error('WhatsApp request failed:', cleanText(error.message, 200));
    return res.status(502).json({ success: false, message: 'تعذر الاتصال بخدمة WhatsApp حاليًا. الطلب لم يتأكد؛ حاول مرة تانية.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error.message === 'Origin not allowed by CORS') return res.status(403).json({ success: false, message: 'المصدر ده غير مسموح له بالاتصال بالسيرفر.' });
  console.error('Request error:', cleanText(error.message, 200));
  return res.status(400).json({ success: false, message: 'تعذر معالجة الطلب.' });
});

app.listen(PORT, () => console.log(`Laroz API listening on port ${PORT}`));
