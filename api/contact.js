import { Resend } from 'resend';

const CONTACT_RECIPIENT = process.env.CONTACT_EMAIL || 'grupoconectasoftware@gmail.com';
const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const rateLimits = new Map();

const allowedValues = {
  propertyType: ['Residential', 'Commercial', 'Industrial'],
  material: ['Marble', 'Travertine', 'Terrazzo', 'Concrete', 'Natural Stone', 'Other'],
  surfaceType: ['Floor', 'Countertop', 'Wall', 'Stairs', 'Exterior', 'Other'],
  service: [
    'Surface Restoration and Refinishing',
    'Honing and Polishing',
    'Cleaning and Sealing',
    'Crack, Chip, and Joint Repair',
    'Concrete Polishing',
    'Maintenance Program',
  ],
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

const clean = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');
const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (rateLimits.get(ip) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) return true;
  recent.push(now);
  rateLimits.set(ip, recent);

  if (rateLimits.size > 500) {
    for (const [key, times] of rateLimits) {
      if (!times.some((time) => now - time < RATE_LIMIT_WINDOW_MS)) rateLimits.delete(key);
    }
  }
  return false;
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function validate(payload) {
  const data = {
    name: clean(payload.name),
    phone: clean(payload.phone),
    email: clean(payload.email).toLowerCase(),
    propertyType: clean(payload.propertyType),
    material: clean(payload.material),
    surfaceType: clean(payload.surfaceType),
    service: clean(payload.service),
    description: typeof payload.description === 'string' ? payload.description.trim() : '',
    consent: payload.consent === true,
  };

  const emailPattern = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,}$/;
  const phonePattern = /^[+()\d\s.-]{7,25}$/;

  if (data.name.length < 2 || data.name.length > 100) return { error: 'Enter a valid full name.' };
  if (!phonePattern.test(data.phone)) return { error: 'Enter a valid phone number.' };
  if (!emailPattern.test(data.email) || data.email.includes('..')) return { error: 'Enter a valid email address.' };
  for (const [field, options] of Object.entries(allowedValues)) {
    if (!options.includes(data[field])) return { error: 'Select valid options in every field.' };
  }
  if (data.description.length < 10 || data.description.length > 3000) {
    return { error: 'The project description must contain between 10 and 3000 characters.' };
  }
  if (!data.consent) return { error: 'You must accept the privacy terms.' };
  return { data };
}

async function handlePost(request) {
  try {
    if (!isSameOrigin(request)) return json({ ok: false, message: 'Request origin not allowed.' }, 403);
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return json({ ok: false, message: 'The request must use JSON.' }, 415);
    }

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ ok: false, message: 'The request is too large.' }, 413);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return json({ ok: false, message: 'The request is too large.' }, 413);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, message: 'Invalid request data.' }, 400);
    }

    // Honeypot and minimum completion time reduce automated form spam.
    if (clean(payload.website)) return json({ ok: true, message: 'Message received.' });
    const startedAt = Number(payload.startedAt);
    const elapsed = Date.now() - startedAt;
    if (!Number.isFinite(startedAt) || elapsed < 2000 || elapsed > 2 * 60 * 60 * 1000) {
      return json({ ok: false, message: 'Please reload the form and try again.' }, 400);
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return json({ ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
    }

    const validation = validate(payload);
    if (validation.error) return json({ ok: false, message: validation.error }, 400);

    const apiKey = process.env.RESEND_API_KEY_RESURFACING_SOLUTIONS;
    if (!apiKey) {
      console.error('Contact API: RESEND_API_KEY_RESURFACING_SOLUTIONS is not configured.');
      return json({ ok: false, message: 'Email service is temporarily unavailable.' }, 500);
    }

    const data = validation.data;
    const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, escapeHtml(value)]));
    const requestId = typeof payload.requestId === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(payload.requestId)
      ? payload.requestId
      : crypto.randomUUID();

    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      {
        from: 'Resurfacing Solutions <onboarding@resend.dev>',
        to: [CONTACT_RECIPIENT],
        replyTo: data.email,
        subject: 'Nuevo mensaje de contacto desde la web',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#212121">
            <div style="background:#212121;padding:24px;color:#fff;border-top:5px solid #d72b2b">
              <h1 style="font-size:22px;margin:0">Nuevo mensaje de contacto</h1>
            </div>
            <div style="padding:24px;border:1px solid #e5e5e5;border-top:0">
              <table role="presentation" style="width:100%;border-collapse:collapse">
                <tr><td style="padding:8px 0;font-weight:bold">Nombre</td><td>${safe.name}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Tel&eacute;fono</td><td>${safe.phone}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Correo</td><td>${safe.email}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Propiedad</td><td>${safe.propertyType}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Material</td><td>${safe.material}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Superficie</td><td>${safe.surfaceType}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Servicio</td><td>${safe.service}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold">Acept&oacute; t&eacute;rminos</td><td>${data.consent ? 'S&iacute;' : 'No'}</td></tr>
              </table>
              <h2 style="font-size:16px;color:#d72b2b;margin:24px 0 8px">Descripci&oacute;n del proyecto</h2>
              <p style="white-space:pre-wrap;line-height:1.6;margin:0">${safe.description}</p>
            </div>
          </div>`,
        text: `Nuevo mensaje de contacto\n\nNombre: ${data.name}\nTelefono: ${data.phone}\nCorreo: ${data.email}\nPropiedad: ${data.propertyType}\nMaterial: ${data.material}\nSuperficie: ${data.surfaceType}\nServicio: ${data.service}\nAcepto terminos: Si\n\nDescripcion:\n${data.description}`,
      },
      { idempotencyKey: `contact-${requestId}` },
    );

    if (result.error) {
      console.error('Contact API: Resend rejected the email.', result.error.name, result.error.message);
      return json({ ok: false, message: 'We could not send your message. Please try again.' }, 500);
    }

    return json({ ok: true, message: 'Your message was sent successfully.' });
  } catch (error) {
    console.error('Contact API: unexpected failure.', error instanceof Error ? error.message : 'Unknown error');
    return json({ ok: false, message: 'We could not send your message. Please try again.' }, 500);
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, message: 'Method not allowed.' }, 405);
    }
    return handlePost(request);
  },
};
