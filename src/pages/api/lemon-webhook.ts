import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import crypto from 'crypto';

// USAR SERVICE_ROLE_KEY es vital para que Supabase te deje escribir sin errores
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY // <--- ¡Importante que el nombre coincida con Netlify!
);

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const LEMON_WEBHOOK_SECRET = import.meta.env.LEMON_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  try {
    const rawBody = await request.text();
    
    // --- 1. VALIDACIÓN DE FIRMA ---
    const hmac = crypto.createHmac('sha256', LEMON_WEBHOOK_SECRET);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (signature.length !== digest.length || !crypto.timingSafeEqual(digest, signature)) {
      return new Response('Firma inválida', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const eventName = body.meta.event_name;

    if (eventName === 'order_created') {
      const email = body.data.attributes.user_email;
      const gameName = body.data.attributes.first_order_item.product_name || "Juego";
      
      // Intentamos sacar el ID de custom_data, si no, usamos el 2 (Hollow Knight)
      const gameId = Number(body.meta.custom_data?.game_id || 2);

      console.log(`Procesando venta para: ${email}, Juego ID: ${gameId}`);

      // --- 2. BUSCAR LLAVE EN SUPABASE ---
      const { data: keyData, error: keyError } = await supabase
        .from('keys_inventory')
        .update({ is_sold: true })
        .eq('game_id', gameId)
        .eq('is_sold', false)
        .select()
        .maybeSingle();

      if (keyError || !keyData) {
        console.error("Sin stock en Supabase:", keyError);
        return new Response(JSON.stringify({ error: "Sin stock" }), { status: 200 });
      }

      // --- 3. REGISTRO DE VENTA ---
      await supabase.from('sales').insert({
        game_id: gameId,
        key_id: keyData.id,
        buyer_email: email,
        sale_price: body.data.attributes.total / 100
      });

      // --- 4. ENVÍO CON RESEND ---
      const { error: mailError } = await resend.emails.send({
        from: 'Tienda <onboarding@resend.dev>',
        to: email,
        subject: `Tu código de ${gameName}`,
        html: `
          <div style="font-family: sans-serif; background: #111; color: white; padding: 20px; border-radius: 10px;">
            <h1 style="color: #7c4dff;">¡Gracias por tu compra!</h1>
            <p>Tu código para <strong>${gameName}</strong> es:</p>
            <div style="background: #222; padding: 15px; border: 1px solid #7c4dff; font-size: 1.5rem; text-align: center; color: #2de29d;">
              ${keyData.key_code}
            </div>
          </div>
        `
      });

      if (mailError) {
        console.error("Error de Resend:", mailError);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Error crítico:", err);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500 });
  }
};