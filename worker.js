
const API_VERSION_DEFAULT = "v25.0";
let lastHelloTestAt = 0;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function cleanText(value, max = 500) {
  return String(value ?? "").trim()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, max);
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function money(value) {
  return `${Number(value).toFixed(2)} EGP`;
}

function safeKeyMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = String(provided);
  const b = String(expected);
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-test-key",
    "Vary": "Origin"
  };

  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

async function sendTemplate(env, {
  recipient,
  name,
  language,
  components
}) {
  const token = env.WHATSAPP_TOKEN;
  const phoneNumberId = env.PHONE_NUMBER_ID;

  if (!token || !phoneNumberId || !recipient) {
    throw new Error("WhatsApp environment variables are incomplete.");
  }

  const version = env.META_API_VERSION || API_VERSION_DEFAULT;

  const url =
    `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name,
      language: { code: language },
      ...(components ? { components } : {})
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.messages?.[0]?.id) {
    const message = cleanText(
      data?.error?.error_user_msg || data?.error?.message,
      240
    );

    throw new Error(
      message || `Meta API returned HTTP ${response.status}`
    );
  }

  return data.messages[0].id;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(request, env);

    const allowed = String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (origin && !allowed.includes(origin)) {
      return json({
        success: false,
        message: "المصدر ده غير مسموح له بالاتصال بالسيرفر."
      }, 403, headers);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers
      });
    }

    // Basic service status
    if (request.method === "GET" && url.pathname === "/") {
      return json({
        service: "laroz-order-api",
        status: "online",
        runtime: "cloudflare-workers"
      }, 200, headers);
    }

    // Health check - never sends a WhatsApp message
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "laroz-order-api",
        runtime: "cloudflare-workers"
      }, 200, headers);
    }

    // Manual hello_world test only
    if (
      request.method === "POST" &&
      url.pathname === "/api/test/hello-world"
    ) {
      if (!safeKeyMatch(
        request.headers.get("x-test-key"),
        env.TEST_ENDPOINT_KEY
      )) {
        return json({
          success: false,
          message: "مفتاح الاختبار غير صحيح."
        }, 401, headers);
      }

      const recipient = digits(env.WHATSAPP_TO);

      if (
        !env.WHATSAPP_TOKEN ||
        !env.PHONE_NUMBER_ID ||
        !recipient
      ) {
        return json({
          success: false,
          message: "إعدادات WhatsApp غير مكتملة في Cloudflare."
        }, 503, headers);
      }

      const cooldown = Math.max(
        30000,
        Number(env.HELLO_TEST_COOLDOWN_MS || 60000)
      );

      const remaining = cooldown - (Date.now() - lastHelloTestAt);

      if (remaining > 0) {
        return json({
          success: false,
          retryAfterSeconds: Math.ceil(remaining / 1000),
          message: `استنى ${Math.ceil(remaining / 1000)} ثانية قبل اختبار تاني.`
        }, 429, headers);
      }

      lastHelloTestAt = Date.now();

      try {
        const messageId = await sendTemplate(env, {
          recipient,
          name: "hello_world",
          language: "en_US"
        });

        return json({
          success: true,
          template: "hello_world",
          messageId,
          message: "Meta قبلت رسالة الاختبار. راجع WhatsApp على رقم الاستقبال."
        }, 200, headers);

      } catch (error) {
        console.error(
          "hello_world test failed:",
          cleanText(error.message, 200)
        );

        return json({
          success: false,
          message: "Meta لم تقبل رسالة الاختبار. راجع حالة الرقم والـToken والمستلم."
        }, 502, headers);
      }
    }

    // Real customer orders remain disabled until template approval
    if (
      request.method === "POST" &&
      url.pathname === "/api/orders"
    ) {
      if (env.ENABLE_ORDER_SENDING !== "true") {
        return json({
          success: false,
          code: "ORDER_SENDING_DISABLED",
          message: "إرسال الطلبات الحقيقية غير مفعّل حاليًا لحين موافقة قالب الطلب."
        }, 503, headers);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return json({
          success: false,
          message: "بيانات الطلب غير صالحة."
        }, 400, headers);
      }

      const orderId = cleanText(body?.orderId, 40);
      const customerName = cleanText(body?.customerName, 80);

      const orderType =
        body?.orderType === "Delivery" ? "Delivery" :
        body?.orderType === "Pickup" ? "Pickup" : "";

      const address = orderType === "Delivery"
        ? cleanText(body?.deliveryAddress, 300)
        : "-";

      const notes = cleanText(body?.notes, 300);
      const items = Array.isArray(body?.items) ? body.items : [];

      if (
        !/^LZ-[A-Z0-9-]{5,40}$/.test(orderId) ||
        !customerName ||
        !orderType ||
        (orderType === "Delivery" && !address) ||
        items.length < 1 ||
        items.length > 40
      ) {
        return json({
          success: false,
          message: "بيانات الطلب ناقصة أو غير صحيحة."
        }, 400, headers);
      }

      let computedTotal = 0;
      const itemLines = [];

      for (const item of items) {
        const name = cleanText(item?.name, 80);
        const quantity = Number(item?.quantity);
        const unitPrice = Number(item?.unitPrice);

        if (
          !name ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 50 ||
          !Number.isFinite(unitPrice) ||
          unitPrice < 0 ||
          unitPrice > 100000
        ) {
          return json({
            success: false,
            message: "فيه صنف أو كمية غير صحيحة في الطلب."
          }, 400, headers);
        }

        computedTotal += quantity * unitPrice;
        itemLines.push(`${quantity}x ${name}`);
      }

      const suppliedTotal = Number(body?.total);

      if (
        !Number.isFinite(suppliedTotal) ||
        Math.abs(suppliedTotal - computedTotal) > 0.01
      ) {
        return json({
          success: false,
          message: "إجمالي الطلب غير متطابق. حدّث السلة وحاول تاني."
        }, 400, headers);
      }

      const parameters = [
        orderId,
        customerName,
        orderType,
        itemLines.join(", ").slice(0, 900),
        money(computedTotal),
        address || "-",
        (notes || "No notes").slice(0, 900)
      ].map(value => ({
        type: "text",
        text: String(value || "-")
      }));

      try {
        const messageId = await sendTemplate(env, {
          recipient: digits(env.WHATSAPP_TO),
          name: env.WHATSAPP_TEMPLATE_NAME || "laroz_new_order",
          language: env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
          components: [{
            type: "body",
            parameters
          }]
        });

        return json({
          success: true,
          orderId,
          messageId
        }, 200, headers);

      } catch (error) {
        console.error(
          "WhatsApp order send failed:",
          cleanText(error.message, 200)
        );

        return json({
          success: false,
          message: "Meta لم تقبل إرسال الطلب. راجع حالة القالب وإعدادات WhatsApp."
        }, 502, headers);
      }
    }

    return json({
      success: false,
      message: "Not found"
    }, 404, headers);
  }
};
