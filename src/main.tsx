import { lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createHashRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./auth";
import { db } from "./api";
import { Footer, Header, State } from "./components";
import { Home, Archive, ArticlePage, Author, About } from "./Public";
import {
  Account,
  Administration,
  Dashboard,
  DeskArticles,
  Login,
  MediaLibrary,
  NewsroomLayout,
  Staff,
} from "./Newsroom";
import "./styles.css";
const ArticleEditor = lazy(() =>
  import("./Editor").then((m) => ({ default: m.ArticleEditor })),
);
function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Header />
      <div id="main-content" tabIndex={-1}>
        <Outlet />
      </div>
      <Footer />
    </>
  );
}
async function start() {
  const authRedirect = new URLSearchParams(window.location.hash.slice(1)).get(
    "type",
  );
  if (db) {
    await db.auth.getSession();
    if (authRedirect === "invite" || authRedirect === "recovery")
      window.location.hash = "/newsroom/settings";
  }
  const router = createHashRouter([
    {
      element: <Layout />,
      children: [
        { path: "/", element: <Home /> },
        { path: "/category/:slug", element: <Archive /> },
        { path: "/archive", element: <Archive /> },
        { path: "/article/:slug", element: <ArticlePage /> },
        { path: "/author/:id", element: <Author /> },
        { path: "/about", element: <About /> },
        { path: "/login", element: <Login /> },
        {
          path: "/newsroom",
          element: <NewsroomLayout />,
          children: [
            { index: true, element: <Dashboard /> },
            { path: "articles", element: <DeskArticles /> },
            { path: "drafts", element: <DeskArticles /> },
            { path: "pending", element: <DeskArticles /> },
            { path: "published", element: <DeskArticles /> },
            {
              path: "create",
              element: (
                <Suspense fallback={<State loading>{null}</State>}>
                  <ArticleEditor />
                </Suspense>
              ),
            },
            {
              path: "edit/:id",
              element: (
                <Suspense fallback={<State loading>{null}</State>}>
                  <ArticleEditor />
                </Suspense>
              ),
            },
            { path: "media", element: <MediaLibrary /> },
            { path: "staff", element: <Staff /> },
            { path: "settings", element: <Account /> },
            { path: "admin", element: <Administration /> },
          ],
        },
        {
          path: "*",
          element: (
            <main className="notice">
              <h1>Story not found.</h1>
              <a href={import.meta.env.BASE_URL}>Return to SANN</a>
            </main>
          ),
        },
      ],
    },
  ]);
  createRoot(document.getElementById("root")!).render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}
void start();
