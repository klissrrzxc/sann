import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const pg = new PGlite();
const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  senior: "00000000-0000-4000-8000-000000000003",
  junior: "00000000-0000-4000-8000-000000000004",
  photo: "00000000-0000-4000-8000-000000000005",
  outsider: "00000000-0000-4000-8000-000000000006",
};
let story: string;
const payload = {
  title: "Тестовая новость редакции",
  category: "politics",
  subtitle: "Role security test",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Русский текст." }],
      },
    ],
  },
  tags: ["RP"],
};
async function asUser<T>(id: string | null, fn: () => Promise<T>) {
  await pg.exec(`set role ${id ? "authenticated" : "anon"}`);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id ?? "",
  ]);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}
const save = (
  id: string | null,
  version: number,
  status: string,
  data: object = payload,
  comment = "",
) =>
  pg.query<{ id: string; version: number; status: string }>(
    `select * from public.save_article($1,$2,$3::jsonb,$4::public.article_status,$5)`,
    [id, version, JSON.stringify(data), status, comment],
  );
beforeAll(async () => {
  await pg.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant select,insert,delete on storage.objects to authenticated;grant select on storage.objects to anon;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create function storage.extension(text) returns text language sql immutable as $$select reverse(split_part(reverse($1),'.',1))$$;`);
  await pg.exec(
    readFileSync(
      new URL("../supabase/migrations/001_newsroom.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [name, id] of Object.entries(ids)) {
    await pg.query("insert into auth.users values($1)", [id]);
    if (name === "outsider") continue;
    await pg.query("insert into public.profiles(id,rp_name) values($1,$2)", [
      id,
      name,
    ]);
    await pg.query("insert into public.staff_roles values($1,$2,true)", [
      id,
      name === "admin"
        ? "administrator"
        : name === "editor"
          ? "editor_in_chief"
          : name === "senior"
            ? "senior_journalist"
            : name === "junior"
              ? "junior_journalist"
              : "photographer",
    ]);
  }
}, 60000);
afterAll(async () => pg.close());
describe.sequential(
  "PostgreSQL RPC and RLS (local Supabase schema stubs)",
  () => {
    it("junior cannot publish via RPC", async () => {
      await expect(
        asUser(ids.junior, () => save(null, 0, "published")),
      ).rejects.toThrow("Junior cannot publish");
    });
    it("junior cannot bypass RPC with a direct table write", async () => {
      await expect(
        asUser(ids.junior, () =>
          pg.query(
            `insert into articles(author_id,title,slug,category,status) values($1,'Bypass','bypass','politics','published')`,
            [ids.junior],
          ),
        ),
      ).rejects.toThrow(/permission denied/);
    });
    it("junior can save and submit, then cannot alter the queued story", async () => {
      const r = await asUser(ids.junior, () => save(null, 0, "draft"));
      story = r.rows[0].id;
      await asUser(ids.junior, () => save(story, 1, "pending_review"));
      await expect(
        asUser(ids.junior, () => save(story, 2, "draft")),
      ).rejects.toThrow("locked");
    });
    it("anonymous cannot read drafts", async () => {
      const r = await asUser(null, () => pg.query("select * from articles"));
      expect(r.rows).toHaveLength(0);
    });
    it("senior cannot modify a junior story", async () => {
      await expect(
        asUser(ids.senior, () => save(story, 2, "published")),
      ).rejects.toThrow("Not your article");
    });
    it("editor returns with comment, junior resubmits, editor publishes", async () => {
      await expect(
        asUser(ids.editor, () => save(story, 2, "changes_requested")),
      ).rejects.toThrow("comment required");
      await asUser(ids.editor, () =>
        save(story, 2, "changes_requested", payload, "Verify the source"),
      );
      await asUser(ids.junior, () => save(story, 3, "pending_review"));
      await asUser(ids.editor, () => save(story, 4, "published"));
      const visible = await asUser(null, () =>
        pg.query("select title from articles"),
      );
      expect(visible.rows).toHaveLength(1);
    });
    it("rejects stale editor versions", async () => {
      await expect(
        asUser(ids.editor, () => save(story, 4, "archived")),
      ).rejects.toThrow("Conflict");
    });
    it("senior can publish own work", async () => {
      const r = await asUser(ids.senior, () => save(null, 0, "published"));
      expect(r.rows[0].status).toBe("published");
    });
    it("photographer and unapproved accounts cannot create articles", async () => {
      for (const id of [ids.photo, ids.outsider])
        await expect(asUser(id, () => save(null, 0, "draft"))).rejects.toThrow(
          "access denied",
        );
    });
    it("staff cannot self-promote through a table write or admin RPC", async () => {
      await expect(
        asUser(ids.junior, () =>
          pg.exec(`update staff_roles set role='administrator'`),
        ),
      ).rejects.toThrow("permission denied");
      await expect(
        asUser(ids.junior, () =>
          pg.query(`select admin_staff($1,'Junior','administrator',true)`, [
            ids.junior,
          ]),
        ),
      ).rejects.toThrow("Administrator required");
    });
    it("administrator assigns staff, but cannot revoke own access", async () => {
      await asUser(ids.admin, () =>
        pg.query(
          `select admin_staff($1,'Invited Reporter','junior_journalist',true)`,
          [ids.outsider],
        ),
      );
      await expect(
        asUser(ids.admin, () =>
          pg.query(`select admin_staff($1,'Admin','junior_journalist',true)`, [
            ids.admin,
          ]),
        ),
      ).rejects.toThrow("own administration");
    });
    it("audit records are append-only and private", async () => {
      const visible = await asUser(ids.junior, () =>
        pg.query("select * from audit_logs"),
      );
      expect(visible.rows).toHaveLength(0);
      const logs = await asUser(ids.admin, () =>
        pg.query("select * from audit_logs"),
      );
      expect(logs.rows.length).toBeGreaterThan(4);
      await expect(
        asUser(ids.admin, () => pg.exec("delete from audit_logs")),
      ).rejects.toThrow("permission denied");
    });
    it("protects private media, referenced images, foreign deletes and deletion races", async () => {
      const path = ids.photo + "/test.webp";
      await pg.query(
        `insert into storage.objects(bucket_id,name,owner_id) values('newsroom',$1,$2)`,
        [path, ids.photo],
      );
      await asUser(ids.photo, () =>
        pg.query(`select register_media($1,'Test image')`, [path]),
      );
      expect(
        (await asUser(null, () => pg.query("select * from storage.objects")))
          .rows,
      ).toHaveLength(0);
      await asUser(ids.editor, () =>
        save(story, 5, "published", { ...payload, cover_path: path }),
      );
      expect(
        (await asUser(null, () => pg.query("select * from storage.objects")))
          .rows,
      ).toHaveLength(1);
      await expect(
        asUser(ids.photo, () =>
          pg.query("select prepare_media_delete($1)", [path]),
        ),
      ).rejects.toThrow("referenced");
      await expect(
        asUser(ids.junior, () =>
          pg.query("select prepare_media_delete($1)", [path]),
        ),
      ).rejects.toThrow("Not your");
      await asUser(ids.editor, () => save(story, 6, "published"));
      await asUser(ids.photo, () =>
        pg.query("select prepare_media_delete($1)", [path]),
      );
      await expect(
        asUser(ids.editor, () =>
          save(story, 7, "published", { ...payload, cover_path: path }),
        ),
      ).rejects.toThrow("being deleted");
      await asUser(ids.photo, () =>
        pg.query(`delete from storage.objects where name=$1`, [path]),
      );
      await asUser(ids.photo, () =>
        pg.query("select forget_media($1)", [path]),
      );
      expect((await pg.query("select * from media_assets")).rows).toHaveLength(
        0,
      );
    });
    it("deactivated accounts lose write access immediately", async () => {
      await asUser(ids.admin, () =>
        pg.query(`select admin_staff($1,'Senior','senior_journalist',false)`, [
          ids.senior,
        ]),
      );
      await expect(
        asUser(ids.senior, () => save(null, 0, "published")),
      ).rejects.toThrow("access denied");
    });
  },
);
