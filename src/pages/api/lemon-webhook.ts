import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

// Conexión a tu Supabase
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const eventName = body.meta.event_name; // Lemon nos dice qué pasó

    // Solo nos importa cuando el pago es exitoso
    if (eventName === 'order_created') {
      const email = body.data.attributes.user_email;
      const gameId = 2; // ID de Hollow Knight según tu imagen ca7774.png

      // 1. Buscamos una key que no esté vendida
      const { data: keyData, error: keyError } = await supabase
        .from('keys_inventory')
        .select('*')
        .eq('game_id', gameId)
        .eq('is_sold', false)
        .limit(1)
        .single();

      if (keyData) {
        // 2. Marcamos la key como vendida
        await supabase
          .from('keys_inventory')
          .update({ is_sold: true })
          .eq('id', keyData.id);

        // 3. Registramos la venta en tu tabla 'sales'
        await supabase.from('sales').insert({
          game_id: gameId,
          key_id: keyData.id,
          buyer_email: email,
          sale_price: body.data.attributes.total / 100, // Lemon envía céntimos (ej: 3550 = 35.50)
          created_at: new Date()
        });

        console.log("¡Venta procesada con éxito!");
      }
    }

    return new Response(JSON.stringify({ message: "Recibido" }), { status: 200 });
  } catch (err) {
    console.error("Error en Webhook:", err);
    return new Response(JSON.stringify({ error: "Fallo" }), { status: 500 });
  }
};