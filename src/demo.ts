import type { Article, Profile } from "./types";
export const demoProfile: Profile = {
  id: "demo-reporter",
  rp_name: "Alex Morgan",
  avatar: "",
  position: "Senior Correspondent",
  biography:
    "Вымышленный корреспондент SANN. Репортажи о жизни штата Сан-Андреас.",
  department: "Metro desk",
  joined_at: "2026-10-01T12:00:00Z",
};
const stories = [
  [
    "investigations",
    "За закрытыми дверями: что известно о предполагаемой деятельности BLACKFIELD",
    "Редакция изучает свидетельства и документы. На этом этапе ни одно обвинение не установлено.",
    "city",
    true,
  ],
  [
    "business",
    "B-EXPERIA открывает неделю новых идей в Лос-Сантосе",
    "Предприниматели обсудят проекты и развитие городской экономики.",
    "event",
    false,
  ],
  [
    "crime-justice",
    "LSPD объявил об усилении патрулирования в центре города",
    "Ведомство представило план безопасности и призвало жителей сообщать о происшествиях.",
    "night",
    false,
  ],
  [
    "politics",
    "Городской совет обсудит транспортный бюджет",
    "Открытое заседание станет площадкой для предложений жителей.",
    "city",
    false,
  ],
  [
    "business",
    "Экономика штата: малый бизнес ищет новые возможности",
    "Репортаж с торговых улиц и разговор с владельцами предприятий.",
    "event",
    false,
  ],
  [
    "crime-justice",
    "Ночной Лос-Сантос: хроника происшествий",
    "Сведения уточняются. Редакция отделяет подтверждённые факты от слухов.",
    "night",
    false,
  ],
  [
    "entertainment",
    "Культурный вечер на набережной собрал жителей штата",
    "Музыка, искусство и городские истории у океана.",
    "event",
    true,
  ],
  [
    "interviews",
    "Люди города: разговор с фоторепортёром",
    "Как заметить историю там, где остальные проходят мимо.",
    "city",
    false,
  ],
  [
    "lifestyle",
    "Маршрут выходного дня: от центра до побережья",
    "Места, в которых стоит остановиться и посмотреть на город по-новому.",
    "city",
    false,
  ],
] as const;
export const demoArticles: Article[] = stories.map((s, i) => ({
  id: `demo-${i}`,
  slug: `rp-dispatch-${i + 1}`,
  author_id: demoProfile.id,
  title: s[1],
  subtitle: s[2],
  category: s[0],
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Демонстрационный материал. Все события и персонажи вымышлены и относятся исключительно к GTA RolePlay.",
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Что известно к этому часу" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text:
              s[2] +
              " Корреспонденты San Andreas News Network продолжают собирать комментарии участников событий. Редакция обновит материал после получения подтверждённых сведений.",
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Мы стремимся к точности и предоставляем сторонам возможность высказаться.",
              },
            ],
          },
        ],
      },
    ],
  },
  cover_path: `illustration:${s[3]}`,
  cover_caption: "Original SANN illustration · Fictional GTA RolePlay setting",
  status: "published",
  featured: s[4],
  is_demo: true,
  version: 1,
  created_at: `2026-11-${String(12 - Math.floor(i / 3)).padStart(2, "0")}T${String(15 - i).padStart(2, "0")}:00:00Z`,
  updated_at: "2026-11-12T12:00:00Z",
  published_at: `2026-11-${String(12 - Math.floor(i / 3)).padStart(2, "0")}T${String(15 - i).padStart(2, "0")}:00:00Z`,
  profiles: demoProfile,
  article_tags: [{ tag: "GTA RolePlay" }, { tag: "San Andreas" }],
}));
