-- Optional fictional content in the REAL database. Trusted SQL Editor only.
-- Uses the existing administrator as author. Does not create auth users or grant roles.
-- All seeded articles carry is_demo=true. Run once after administrator bootstrap.
begin;
insert into public.articles(slug,author_id,title,subtitle,category,content,status,featured,is_demo,published_at)
select s.slug,owner.user_id,s.title,s.subtitle,s.category,
jsonb_build_object('type','doc','content',jsonb_build_array(
 jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Демонстрационная RP-новость. Все события и организации описаны в вымышленном игровом контексте GTA RolePlay.'))),
 jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',s.subtitle)))
)), 'published',s.featured,true,now()-s.age*interval '1 hour'
from (values
 ('rp-blackfield','BLACKFIELD: редакция проверяет сообщения о предполагаемой деятельности','Публикация содержит вымышленные предположения внутри GTA RolePlay. Обвинения не установлены.','investigations',true,1),
 ('rp-b-experia','B-EXPERIA представила программу деловых мероприятий','Вымышленные предприниматели Лос-Сантоса обсуждают новые городские проекты.','business',false,2),
 ('rp-lspd','LSPD представил план городского патрулирования','Внутриигровое ведомство рассказало о работе с обращениями жителей.','crime-justice',false,3),
 ('rp-economy','Экономика штата: новые возможности для малого бизнеса','Вымышленный репортаж о торговых улицах и развитии предпринимательства.','business',false,4),
 ('rp-crime','Ночной Лос-Сантос: редакционная хроника','Редакция проверяет игровые сообщения о происшествиях. Информация уточняется.','crime-justice',false,5),
 ('rp-culture','Музыкальный вечер на побережье собрал жителей','Вымышленный культурный репортаж из мира GTA RolePlay.','entertainment',true,6)
) as s(slug,title,subtitle,category,featured,age)
cross join (select user_id from public.staff_roles where role='administrator' and active limit 1) owner
on conflict(slug) do nothing;
commit;
