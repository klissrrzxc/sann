-- Trusted SQL Editor only. Preview exactly which sample rows will be removed.
select id,title from public.articles where is_demo;
-- To remove the sample rows, deliberately run this separate transaction:
-- begin;
-- delete from public.editorial_reviews where article_id in (select id from public.articles where is_demo);
-- delete from public.articles where is_demo;
-- commit;
