import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { allowedStatuses, canEdit, safeLink, type Article } from "./types";
import { RichBody } from "./components";
describe("Editorial UI permissions", () => {
  const article = { author_id: "alice", status: "draft" } as Article;
  it("never offers direct publication to juniors", () => {
    expect(allowedStatuses("junior_journalist")).toEqual([
      "draft",
      "pending_review",
    ]);
  });
  it("allows seniors to publish their own work", () => {
    expect(allowedStatuses("senior_journalist")).toContain("published");
    expect(canEdit("senior_journalist", "alice", article)).toBe(true);
  });
  it("blocks foreign edits and locks junior review submissions", () => {
    expect(canEdit("senior_journalist", "bob", article)).toBe(false);
    expect(
      canEdit("junior_journalist", "alice", {
        ...article,
        status: "pending_review",
      }),
    ).toBe(false);
    expect(canEdit("editor_in_chief", "bob", article)).toBe(true);
    expect(canEdit("photographer", "alice", article)).toBe(false);
  });
});
describe("Structured article rendering", () => {
  it("escapes text and ignores executable nodes and marks", () => {
    const html = renderToStaticMarkup(
      <RichBody
        node={{
          type: "doc",
          content: [
            {
              type: "text",
              text: "<script>alert(1)</script>",
              marks: [{ type: "script" }],
            },
            { type: "script", attrs: { onclick: "alert(1)" } },
          ],
        }}
      />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
  });
  it("rejects unsafe avatar schemes", () => {
    expect(safeLink("javascript:alert(1)")).toBeUndefined();
    expect(safeLink("data:text/html,test")).toBeUndefined();
    expect(safeLink("https://example.com/avatar.webp")).toBe(
      "https://example.com/avatar.webp",
    );
  });
});
