import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const LEMON_WEBHOOK_SECRET = import.meta.env.LEMON_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  try {
    // --- 1. VALIDACIÓN DE SEGURIDAD (PASO 5) ---
    const rawBody = await request.text();
    const hmac = crypto.createHmac('sha256', LEMON_WEBHOOK_SECRET);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return new Response('Firma inválida', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventName = body.meta.event_name;

    if (eventName === 'order_created') {
      const email = body.data.attributes.user_email;
      const gameId = Number(body.meta.custom_data?.game_id || 2);
      const gameTitle = body.data.attributes.first_order_item.variant_name;

      // --- 2. ESCUDO ANTI-DUPLICADOS (PASO 2 Y 3) ---
      const { data: keyData, error: keyError } = await supabase
        .from('keys_inventory')
        .update({ is_sold: true })
        .eq('game_id', gameId)
        .eq('is_sold', false)
        .select('*')
        .limit(1)
        .single();

      if (keyError || !keyData) {
        console.error("ERROR: No hay llaves disponibles para el juego ID:", gameId);
        return new Response(JSON.stringify({ error: "Sin stock" }), { status: 200 });
      }

      // --- 3. REGISTRO DE VENTA ---
      await supabase.from('sales').insert({
        game_id: gameId,
        key_id: keyData.id,
        buyer_email: email,
        sale_price: body.data.attributes.total / 100,
        created_at: new Date()
      });

      // --- 4. ENVÍO DE EMAIL CON RESEND (PASO 4) ---
      try {
        await resend.emails.send({
          from: 'Darlioshop <onboarding@resend.dev>',
          to: email,
          subject: `¡Tu código de ${gameTitle} ha llegado!`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; background-color: #111821; color: white; border-radius: 10px;">
              <h1 style="color: #7c4dff;">¡Gracias por tu compra!</h1>
              <p>Aquí tienes tu llave para <strong>${gameTitle}</strong>:</p>
              <div style="background-color: #1c232d; padding: 20px; border: 2px solid #7c4dff; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h2 style="margin: 0; letter-spacing: 3px; color: #2de29d; font-family: monospace;">${keyData.key_code}</h2>
              </div>
              <p style="font-size: 0.8rem; color: #888;">Disfruta tu juego. Si tienes problemas, contáctanos.</p>
            </div>
          `
        });
        console.log(`Email enviado con éxito a ${email}`);
      } catch (mailError) {
        console.error("Error al enviar el email:", mailError);
      }
    }

    return new Response(JSON.stringify({ message: "Éxito" }), { status: 200 });
  } catch (err) {
    console.error("Error en Webhook:", err);
    return new Response(JSON.stringify({ error: "Fallo interno" }), { status: 500 });
  }
};