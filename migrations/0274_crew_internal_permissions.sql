-- Only new menus and default-off rows; existing grants are never changed.
DO $$
DECLARE parent_id text; menu_name text; menu_uuid text;
BEGIN
  SELECT muid INTO STRICT parent_id FROM adm_menumaster_ac
    WHERE lower(btrim(name))='crew database' AND is_active AND NOT is_deleted;
  FOREACH menu_name IN ARRAY ARRAY['Internal Comments','Internal Actions'] LOOP
    menu_uuid := CASE WHEN menu_name='Internal Comments' THEN 'cp-internal-comments' ELSE 'cp-internal-actions' END;
    INSERT INTO adm_menumaster_ac(muid,name,display_name,route,parent_menu,sort_order)
      VALUES(menu_uuid,menu_name,menu_name,
        CASE WHEN menu_name='Internal Comments' THEN '/crew-internal/comments' ELSE '/crew-internal/actions' END,
        parent_id,CASE WHEN menu_name='Internal Comments' THEN 98 ELSE 99 END);
    INSERT INTO adm_roleaccess_ac(rauid,menu_id,role_id,canview,cancreate,canedit,candelete)
      SELECT (md5('internal-'||menu_uuid||'-'||ruid)::uuid)::text,menu_uuid,ruid,false,false,false,false
      FROM adm_rolemaster_ac WHERE NOT is_deleted
      AND NOT EXISTS(SELECT 1 FROM adm_roleaccess_ac WHERE menu_id=menu_uuid AND role_id=ruid);
  END LOOP;
END $$;
