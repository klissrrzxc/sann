import { createClient } from "npm:@supabase/supabase-js@2.119.0";
const expectedHash = "CHECK_HASH";
Deno.serve(async (req: Request) => {
  const raw = new TextEncoder().encode(req.headers.get("x-sann-check") ?? "");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", raw)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== expectedHash)
    return new Response("Unauthorized", { status: 401 });
  const url = Deno.env.get("SUPABASE_URL")!,
    anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    opts,
  );
  const anon = createClient(url, anonKey, opts);
  const accounts: {
    id: string;
    role: string;
    client: ReturnType<typeof createClient>;
  }[] = [];
  const checks: string[] = [];
  let assetPath: string | null = null,
    failure = "",
    cleanupFailure = "";
  const requireOk = (error: unknown, name: string) => {
    if (error)
      throw new Error(
        name +
          ": " +
          (typeof error === "object" && error && "message" in error
            ? error.message
            : String(error)),
      );
  };
  const check = (condition: boolean, name: string) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const payload = {
    title: "SANN disposable integration check",
    subtitle: "Temporary verification data",
    category: "politics",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Temporary SANN integration verification. Not editorial content.",
            },
          ],
        },
      ],
    },
  };
  const save = (
    client: ReturnType<typeof createClient>,
    id: string | null,
    version: number,
    status: string,
    data: object = payload,
    comment = "",
  ) =>
    client.rpc("save_article", {
      p_id: id,
      p_version: version,
      p_data: data,
      p_status: status,
      p_comment: comment,
    });
  try {
    const nonce = crypto.randomUUID(),
      password = crypto.randomUUID() + crypto.randomUUID();
    for (const role of [
      "administrator",
      "editor_in_chief",
      "senior_journalist",
      "junior_journalist",
      "photographer",
    ]) {
      const email = `sann-check-${nonce}-${role}@example.invalid`;
      const { data, error } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      requireOk(error, "Create test account");
      if (!data.user) throw new Error("Missing test user");
      const client = createClient(url, anonKey, opts);
      accounts.push({ id: data.user.id, role, client });
      requireOk(
        (
          await service
            .from("profiles")
            .insert({ id: data.user.id, rp_name: "SANN disposable check" })
        ).error,
        "Create test profile",
      );
      requireOk(
        (
          await service
            .from("staff_roles")
            .insert({ user_id: data.user.id, role })
        ).error,
        "Assign test role",
      );
      const signed = await client.auth.signInWithPassword({ email, password });
      requireOk(signed.error, "Real password sign-in");
    }
    checks.push("Real Auth password sign-in succeeds for all five staff roles");
    const [admin, editor, senior, junior, photo] = accounts.map(
      (a) => a.client,
    );
    const juniorId = accounts[3].id,
      photoId = accounts[4].id;
    let denied = await save(junior, null, 0, "published");
    check(
      !!denied.error && denied.error.message.includes("Junior cannot publish"),
      "Junior direct publication denied through REST RPC",
    );
    const roleWrite = await junior
      .from("staff_roles")
      .update({ role: "administrator" })
      .eq("user_id", juniorId);
    check(!!roleWrite.error, "Direct role escalation denied");
    const escalation = await junior.rpc("admin_staff", {
      p_user_id: juniorId,
      p_name: "SANN check",
      p_role: "administrator",
      p_active: true,
    });
    check(!!escalation.error, "Role RPC escalation denied");
    let saved = await save(junior, null, 0, "draft");
    requireOk(saved.error, "Save real draft");
    const story = saved.data.id;
    const hidden = await anon.from("articles").select("id").eq("id", story);
    requireOk(hidden.error, "Anonymous read");
    check(hidden.data?.length === 0, "Draft hidden from public HTTP API");
    const foreign = await save(senior, story, 1, "published");
    check(!!foreign.error, "Senior foreign edit denied");
    saved = await save(junior, story, 1, "pending_review");
    requireOk(saved.error, "Submit review");
    denied = await save(junior, story, 2, "draft");
    check(!!denied.error, "Junior pending story locked");
    saved = await save(
      editor,
      story,
      2,
      "changes_requested",
      payload,
      "Verify the source",
    );
    requireOk(saved.error, "Request changes");
    saved = await save(junior, story, 3, "pending_review");
    requireOk(saved.error, "Resubmit");
    saved = await save(editor, story, 4, "published");
    requireOk(saved.error, "Approve");
    checks.push(
      "Junior draft → review → changes → resubmission → editor publication succeeds",
    );
    denied = await save(editor, story, 4, "archived");
    check(
      !!denied.error && denied.error.message.includes("Conflict"),
      "Stale concurrent save rejected",
    );
    const seniorStory = await save(senior, null, 0, "published");
    requireOk(seniorStory.error, "Senior publication");
    checks.push("Senior publishes own article through real HTTP API");
    const read = await anon
      .from("articles")
      .select("*,profiles(*),article_tags(tag)")
      .eq("id", story)
      .single();
    requireOk(read.error, "Published article read");
    check(
      read.data?.id === story,
      "Published story and author persist and load using a fresh anonymous client",
    );
    assetPath = `${photoId}/${crypto.randomUUID()}.png`;
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9S8AAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    requireOk(
      (
        await photo.storage
          .from("newsroom")
          .upload(assetPath, bytes, { contentType: "image/png" })
      ).error,
      "Real Storage upload",
    );
    requireOk(
      (
        await photo.rpc("register_media", {
          p_path: assetPath,
          p_caption: "Disposable check image",
        })
      ).error,
      "Register Storage asset",
    );
    const privateRead = await anon.storage
      .from("newsroom")
      .createSignedUrl(assetPath, 60);
    check(
      !!privateRead.error,
      "Unpublished photograph hidden from public Storage API",
    );
    saved = await save(editor, story, 5, "published", {
      ...payload,
      cover_path: assetPath,
    });
    requireOk(saved.error, "Attach published cover");
    const signed = await anon.storage
      .from("newsroom")
      .createSignedUrl(assetPath, 60);
    requireOk(signed.error, "Public signed photograph URL");
    check(
      !!signed.data && (await fetch(signed.data.signedUrl)).ok,
      "Published photograph downloads using an expiring signed URL",
    );
    const used = await photo.rpc("prepare_media_delete", { p_path: assetPath });
    check(!!used.error, "Referenced photograph deletion blocked");
    const foreignMedia = await junior.rpc("prepare_media_delete", {
      p_path: assetPath,
    });
    check(!!foreignMedia.error, "Foreign photograph deletion blocked");
    saved = await save(editor, story, 6, "published");
    requireOk(saved.error, "Detach cover");
    requireOk(
      (await photo.rpc("prepare_media_delete", { p_path: assetPath })).error,
      "Reserve media deletion",
    );
    requireOk(
      (await photo.storage.from("newsroom").remove([assetPath])).error,
      "Delete own unused image",
    );
    requireOk(
      (await photo.rpc("forget_media", { p_path: assetPath })).error,
      "Forget deleted media",
    );
    checks.push(
      "Photographer uploads, registers and deletes own unused image through Storage API",
    );
    assetPath = null;
    const disabled = await admin.rpc("admin_staff", {
      p_user_id: accounts[2].id,
      p_name: "SANN disposable check",
      p_role: "senior_journalist",
      p_active: false,
    });
    requireOk(disabled.error, "Deactivate staff");
    const staleToken = await save(senior, null, 0, "published");
    check(
      !!staleToken.error,
      "Deactivated staff denied despite existing authenticated session",
    );
    const noAuthInvite = await fetch(url + "/functions/v1/staff-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    check(
      noAuthInvite.status === 401,
      "Staff invitation endpoint rejects unauthenticated calls",
    );
  } catch (e) {
    failure = e instanceof Error ? e.message : "Integration check failed";
  } finally {
    const ids = accounts.map((a) => a.id);
    if (ids.length) {
      try {
        for (const account of accounts) await account.client.auth.signOut();
        requireOk(
          (await service.from("editorial_reviews").delete().in("actor_id", ids))
            .error,
          "Cleanup reviews",
        );
        requireOk(
          (await service.from("articles").delete().in("author_id", ids)).error,
          "Cleanup stories",
        );
        if (assetPath)
          requireOk(
            (await service.storage.from("newsroom").remove([assetPath])).error,
            "Cleanup upload",
          );
        requireOk(
          (await service.from("media_assets").delete().in("owner_id", ids))
            .error,
          "Cleanup assets",
        );
        requireOk(
          (await service.from("staff_roles").delete().in("user_id", ids)).error,
          "Cleanup staff roles",
        );
        requireOk(
          (await service.from("profiles").delete().in("id", ids)).error,
          "Cleanup profiles",
        );
        requireOk(
          (await service.from("audit_logs").delete().in("actor_id", ids)).error,
          "Cleanup test audit",
        );
        for (const id of ids)
          requireOk(
            (await service.auth.admin.deleteUser(id)).error,
            "Cleanup Auth user",
          );
      } catch (e) {
        cleanupFailure = e instanceof Error ? e.message : "Cleanup failed";
      }
    }
  }
  return Response.json({
    success: !failure && !cleanupFailure,
    checks,
    failure: failure || undefined,
    cleanup:
      cleanupFailure || "All disposable accounts and their records removed",
    ...(cleanupFailure ? { fixture_ids: accounts.map((a) => a.id) } : {}),
  });
});
