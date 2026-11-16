-- Staged outside the scanned migrations directory until read-only preflight.
-- Additive: no existing business rows/grants/targets are updated or backfilled.
-- Rollback limitation: once targets or KPI audit events exist, removing these
-- tables/catalogue would destroy configuration/provenance. Refuse rollback
-- until separately approved preservation/removal; never silently discard data.
CREATE TABLE kpi_definitions (
  kpi_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  menu_group text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('minimum','maximum')),
  unit text NOT NULL CHECK (unit IN ('percentage','count','score','rate')),
  calculation_key text NOT NULL,
  calculation_version text NOT NULL,
  period_basis text NOT NULL CHECK (period_basis IN ('annual_percentage','annual_count','snapshot','period_average')),
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE kpi_components (
  component_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_uuid uuid NOT NULL REFERENCES kpi_definitions(kpi_uuid),
  code text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL,
  UNIQUE(kpi_uuid,code),
  UNIQUE(component_uuid,kpi_uuid)
);
CREATE TABLE kpi_target_years (
  target_year_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_uuid uuid NOT NULL REFERENCES kpi_definitions(kpi_uuid),
  year integer NOT NULL CHECK(year BETWEEN 1900 AND 9999),
  scope text NOT NULL DEFAULT 'company' CHECK(scope='company'),
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  UNIQUE(kpi_uuid,year,scope),
  UNIQUE(target_year_uuid,kpi_uuid)
);
CREATE TABLE kpi_target_values (
  target_year_uuid uuid NOT NULL,
  component_uuid uuid NOT NULL,
  kpi_uuid uuid NOT NULL,
  target_value numeric NOT NULL CHECK(target_value >= 0 AND target_value::text NOT IN ('NaN','Infinity','-Infinity')),
  PRIMARY KEY(target_year_uuid,component_uuid),
  FOREIGN KEY(target_year_uuid,kpi_uuid) REFERENCES kpi_target_years(target_year_uuid,kpi_uuid),
  FOREIGN KEY(component_uuid,kpi_uuid) REFERENCES kpi_components(component_uuid,kpi_uuid)
);
CREATE FUNCTION kpi_validate_target_value() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_unit text;
BEGIN
  SELECT unit INTO target_unit FROM kpi_definitions WHERE kpi_uuid=NEW.kpi_uuid;
  IF (target_unit='percentage' AND NEW.target_value > 100)
     OR (target_unit='count' AND NEW.target_value <> trunc(NEW.target_value)) THEN
    RAISE EXCEPTION 'Target does not match the KPI unit' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER kpi_target_value_unit BEFORE INSERT OR UPDATE ON kpi_target_values
  FOR EACH ROW EXECUTE FUNCTION kpi_validate_target_value();
INSERT INTO kpi_definitions(kpi_uuid,code,label,menu_group,direction,unit,calculation_key,calculation_version,period_basis,sort_order) VALUES
 ('74360000-0000-4000-8000-000000000001','retention','Retention Rate','Training & Retention','minimum','percentage','crew_retention','1','annual_percentage',1),
 ('74360000-0000-4000-8000-000000000002','alcohol_violations','Alcohol violations','Training & Retention','maximum','count','da_personnel_alcohol_violations','1','annual_count',2),
 ('74360000-0000-4000-8000-000000000003','drug_violations','Drug violations','Training & Retention','maximum','count','da_personnel_drug_violations','1','annual_count',3);
INSERT INTO kpi_components(component_uuid,kpi_uuid,code,label,sort_order) VALUES
 ('74360000-0000-4000-8000-000000000011','74360000-0000-4000-8000-000000000001','senior_officers','Senior Officers',1),
 ('74360000-0000-4000-8000-000000000012','74360000-0000-4000-8000-000000000001','officers','Officers',2),
 ('74360000-0000-4000-8000-000000000013','74360000-0000-4000-8000-000000000001','ratings','Ratings',3),
 ('74360000-0000-4000-8000-000000000021','74360000-0000-4000-8000-000000000002','overall','Overall',1),
 ('74360000-0000-4000-8000-000000000031','74360000-0000-4000-8000-000000000003','overall','Overall',1);
INSERT INTO adm_menumaster_ac(muid,name,display_name,route,parent_menu,sort_order)
 SELECT gen_random_uuid()::text,'KPIs','KPIs','/admin/kpis',muid,
   coalesce((SELECT max(sort_order) FROM adm_menumaster_ac WHERE parent_menu=a.muid),0)+1
 FROM adm_menumaster_ac a WHERE lower(btrim(name))='admin' AND NOT is_deleted;
-- No adm_resource_action_grants / adm_roleaccess_ac rows are created.
