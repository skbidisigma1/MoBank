export const config = { runtime: "edge" };

function formatDiscordMessage(evt) {
  const { id, type, time, data } = evt;
  const prettied = JSON.stringify(data, null, 2);
  return `🔔 **Auth0 Event**\n• **Type:** ${type}\n• **ID:** ${id}\n• **Time:** ${time}\n\u200B\n\u200B\n\`\`\`json\n${prettied}\n\`\`\``;
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected   = `Bearer ${process.env.AUTH0_WEBHOOK_TOKEN}`;
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  let event;
  try {
    event = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const message = formatDiscordMessage(event);

  try {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message })
    });
  } catch (err) {
    console.error("Discord webhook failed", err);
  }

  return new Response(null, { status: 204 });
}