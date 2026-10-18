import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// Deploy only after setting the cron secret and an approved Meta template.
// No messages are sent by the website or by migrations.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
    phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const template = Deno.env.get("WHATSAPP_RENEWAL_TEMPLATE"),
    version = Deno.env.get("WHATSAPP_GRAPH_VERSION");
  if (
    !token ||
    !phoneId ||
    !template ||
    !version ||
    !/^v\d+\.\d+$/.test(version) ||
    !/^\d+$/.test(phoneId)
  )
    return new Response(
      "Configure WhatsApp credentials, API version and approved template",
      { status: 503 },
    );
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { error: enqueueError } = await db.rpc("enqueue_renewal_reminders");
  if (enqueueError)
    return Response.json({ error: "enqueue_failed" }, { status: 500 });
  const { data: jobs, error } = await db.rpc("claim_reminders");
  if (error) return Response.json({ error: "claim_failed" }, { status: 500 });
  let sent = 0,
    failed = 0;
  for (const job of jobs || []) {
    const { data: party } = await db
      .from("parties")
      .select("name,whatsapp,wa_opt_in")
      .eq("id", job.party_id)
      .eq("tenant_id", job.tenant_id)
      .single();
    const { data: contract } = await db
      .from("customer_contracts")
      .select("ref_no,end_date,status")
      .eq("id", job.contract_id)
      .eq("tenant_id", job.tenant_id)
      .single();
    const { data: module } = await db
      .from("tenant_modules")
      .select("enabled")
      .eq("tenant_id", job.tenant_id)
      .eq("module_key", "whatsapp")
      .maybeSingle();
    const to = party?.whatsapp?.replace(/\D/g, "");
    if (
      !party?.wa_opt_in ||
      !to ||
      !/^[1-9]\d{7,14}$/.test(to) ||
      !module?.enabled ||
      contract?.status !== "active" ||
      contract.end_date !== job.renewal_date
    ) {
      await db
        .from("whatsapp_outbox")
        .update({
          status: "failed",
          last_error: "Consent, phone, module or contract eligibility changed",
        })
        .eq("id", job.id);
      failed++;
      continue;
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/${version}/${phoneId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: template,
              language: {
                code: Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "ar",
              },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: party.name },
                    { type: "text", text: contract.ref_no || job.contract_id },
                    { type: "text", text: contract.end_date },
                  ],
                },
              ],
            },
          }),
        },
      );
      const body = await response.json();
      const id = body.messages?.[0]?.id;
      const accepted = response.ok && typeof id === "string";
      const update = {
        status: accepted ? "sent" : response.ok ? "uncertain" : "failed",
        provider_message_id: accepted ? id : null,
        sent_at: accepted ? new Date().toISOString() : null,
        last_error: accepted
          ? null
          : `provider_code:${body.error?.code || response.status}`,
      };
      const { error: saveError } = await db
        .from("whatsapp_outbox")
        .update(update)
        .eq("id", job.id);
      // A successful send with a failed DB acknowledgement remains processing for manual reconciliation.
      if (saveError) failed++;
      else if (accepted) sent++;
      else failed++;
    } catch {
      // A timeout may mean the provider accepted the message. Never automatically resend an ambiguous attempt.
      await db
        .from("whatsapp_outbox")
        .update({
          status: "uncertain",
          last_error:
            "Delivery result unknown; reconcile with Meta before retrying",
        })
        .eq("id", job.id);
      failed++;
    }
  }
  return Response.json({ claimed: jobs?.length || 0, sent, failed });
});
