--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (415ebe8)
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.vessel_ranks DROP CONSTRAINT IF EXISTS vessel_ranks_vessel_id_vessels_id_fk;
ALTER TABLE IF EXISTS ONLY public.vessel_ranks DROP CONSTRAINT IF EXISTS vessel_ranks_revision_id_revisions_id_fk;
ALTER TABLE IF EXISTS ONLY public.revisions DROP CONSTRAINT IF EXISTS revisions_vessel_id_vessels_id_fk;
ALTER TABLE IF EXISTS ONLY public.rank_groups DROP CONSTRAINT IF EXISTS rank_groups_form_id_forms_id_fk;
ALTER TABLE IF EXISTS ONLY public.master_data_entries DROP CONSTRAINT IF EXISTS master_data_entries_master_id_data_masters_id_fk;
ALTER TABLE IF EXISTS ONLY public.appraisal_results DROP CONSTRAINT IF EXISTS appraisal_results_form_id_forms_id_fk;
ALTER TABLE IF EXISTS ONLY public.appraisal_results DROP CONSTRAINT IF EXISTS appraisal_results_crew_member_id_crew_members_id_fk;
ALTER TABLE IF EXISTS ONLY public.vessels DROP CONSTRAINT IF EXISTS vessels_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_violation_comments DROP CONSTRAINT IF EXISTS vessel_violation_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_revisions DROP CONSTRAINT IF EXISTS vessel_revisions_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_ranks DROP CONSTRAINT IF EXISTS vessel_ranks_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_planning DROP CONSTRAINT IF EXISTS vessel_planning_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_groups DROP CONSTRAINT IF EXISTS vessel_groups_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_drafts DROP CONSTRAINT IF EXISTS vessel_drafts_pkey;
ALTER TABLE IF EXISTS ONLY public.vessel_dateline_adjustments DROP CONSTRAINT IF EXISTS vessel_dateline_adjustments_pkey;
ALTER TABLE IF EXISTS ONLY public.variable_tasks DROP CONSTRAINT IF EXISTS variable_tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.seafarers DROP CONSTRAINT IF EXISTS seafarers_pkey;
ALTER TABLE IF EXISTS ONLY public.rotation_plans DROP CONSTRAINT IF EXISTS rotation_plans_pkey;
ALTER TABLE IF EXISTS ONLY public.revisions DROP CONSTRAINT IF EXISTS revisions_pkey;
ALTER TABLE IF EXISTS ONLY public.rest_hours_vessel_records DROP CONSTRAINT IF EXISTS rest_hours_vessel_records_pkey;
ALTER TABLE IF EXISTS ONLY public.rest_hours_daily_records DROP CONSTRAINT IF EXISTS rest_hours_daily_records_pkey;
ALTER TABLE IF EXISTS ONLY public.rest_hours_crew_records DROP CONSTRAINT IF EXISTS rest_hours_crew_records_pkey;
ALTER TABLE IF EXISTS ONLY public.recruitment_candidates DROP CONSTRAINT IF EXISTS recruitment_candidates_pkey;
ALTER TABLE IF EXISTS ONLY public.recruitment_candidates DROP CONSTRAINT IF EXISTS recruitment_candidates_file_no_unique;
ALTER TABLE IF EXISTS ONLY public.rank_groups DROP CONSTRAINT IF EXISTS rank_groups_pkey;
ALTER TABLE IF EXISTS ONLY public.promotion_hierarchies DROP CONSTRAINT IF EXISTS promotion_hierarchies_pkey;
ALTER TABLE IF EXISTS ONLY public.office_violation_comments DROP CONSTRAINT IF EXISTS office_violation_comments_pkey;
ALTER TABLE IF EXISTS ONLY public.nc_reports DROP CONSTRAINT IF EXISTS nc_reports_pkey;
ALTER TABLE IF EXISTS ONLY public.master_data_entries DROP CONSTRAINT IF EXISTS master_data_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.id_counters DROP CONSTRAINT IF EXISTS id_counters_pkey;
ALTER TABLE IF EXISTS ONLY public.id_counters DROP CONSTRAINT IF EXISTS id_counters_counter_type_unique;
ALTER TABLE IF EXISTS ONLY public.forms DROP CONSTRAINT IF EXISTS forms_pkey;
ALTER TABLE IF EXISTS ONLY public.fixed_tasks DROP CONSTRAINT IF EXISTS fixed_tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.drug_alcohol_test_records DROP CONSTRAINT IF EXISTS drug_alcohol_test_records_pkey;
ALTER TABLE IF EXISTS ONLY public.data_masters DROP CONSTRAINT IF EXISTS data_masters_pkey;
ALTER TABLE IF EXISTS ONLY public.crew_members DROP CONSTRAINT IF EXISTS crew_members_pkey;
ALTER TABLE IF EXISTS ONLY public.company_ranks DROP CONSTRAINT IF EXISTS company_ranks_pkey;
ALTER TABLE IF EXISTS ONLY public.available_ranks DROP CONSTRAINT IF EXISTS available_ranks_pkey;
ALTER TABLE IF EXISTS ONLY public.appraisal_results DROP CONSTRAINT IF EXISTS appraisal_results_pkey;
ALTER TABLE IF EXISTS ONLY drizzle.__drizzle_migrations DROP CONSTRAINT IF EXISTS __drizzle_migrations_pkey;
ALTER TABLE IF EXISTS public.vessels ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_violation_comments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_revisions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_ranks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_planning ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_groups ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_drafts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vessel_dateline_adjustments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.variable_tasks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.seafarers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rotation_plans ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.revisions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rest_hours_vessel_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rest_hours_daily_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rest_hours_crew_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rank_groups ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.promotion_hierarchies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.office_violation_comments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.nc_reports ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.master_data_entries ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.id_counters ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.forms ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.fixed_tasks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.drug_alcohol_test_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.available_ranks ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.appraisal_results ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS drizzle.__drizzle_migrations ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.vessels_id_seq;
DROP TABLE IF EXISTS public.vessels;
DROP SEQUENCE IF EXISTS public.vessel_violation_comments_id_seq;
DROP TABLE IF EXISTS public.vessel_violation_comments;
DROP SEQUENCE IF EXISTS public.vessel_revisions_id_seq;
DROP TABLE IF EXISTS public.vessel_revisions;
DROP SEQUENCE IF EXISTS public.vessel_ranks_id_seq;
DROP TABLE IF EXISTS public.vessel_ranks;
DROP SEQUENCE IF EXISTS public.vessel_planning_id_seq;
DROP TABLE IF EXISTS public.vessel_planning;
DROP SEQUENCE IF EXISTS public.vessel_groups_id_seq;
DROP TABLE IF EXISTS public.vessel_groups;
DROP SEQUENCE IF EXISTS public.vessel_drafts_id_seq;
DROP TABLE IF EXISTS public.vessel_drafts;
DROP SEQUENCE IF EXISTS public.vessel_dateline_adjustments_id_seq;
DROP TABLE IF EXISTS public.vessel_dateline_adjustments;
DROP SEQUENCE IF EXISTS public.variable_tasks_id_seq;
DROP TABLE IF EXISTS public.variable_tasks;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.seafarers_id_seq;
DROP TABLE IF EXISTS public.seafarers;
DROP SEQUENCE IF EXISTS public.rotation_plans_id_seq;
DROP TABLE IF EXISTS public.rotation_plans;
DROP SEQUENCE IF EXISTS public.revisions_id_seq;
DROP TABLE IF EXISTS public.revisions;
DROP SEQUENCE IF EXISTS public.rest_hours_vessel_records_id_seq;
DROP TABLE IF EXISTS public.rest_hours_vessel_records;
DROP SEQUENCE IF EXISTS public.rest_hours_daily_records_id_seq;
DROP TABLE IF EXISTS public.rest_hours_daily_records;
DROP SEQUENCE IF EXISTS public.rest_hours_crew_records_id_seq;
DROP TABLE IF EXISTS public.rest_hours_crew_records;
DROP TABLE IF EXISTS public.recruitment_candidates;
DROP SEQUENCE IF EXISTS public.rank_groups_id_seq;
DROP TABLE IF EXISTS public.rank_groups;
DROP SEQUENCE IF EXISTS public.promotion_hierarchies_id_seq;
DROP TABLE IF EXISTS public.promotion_hierarchies;
DROP SEQUENCE IF EXISTS public.office_violation_comments_id_seq;
DROP TABLE IF EXISTS public.office_violation_comments;
DROP SEQUENCE IF EXISTS public.nc_reports_id_seq;
DROP TABLE IF EXISTS public.nc_reports;
DROP SEQUENCE IF EXISTS public.master_data_entries_id_seq;
DROP TABLE IF EXISTS public.master_data_entries;
DROP SEQUENCE IF EXISTS public.id_counters_id_seq;
DROP TABLE IF EXISTS public.id_counters;
DROP SEQUENCE IF EXISTS public.forms_id_seq;
DROP TABLE IF EXISTS public.forms;
DROP SEQUENCE IF EXISTS public.fixed_tasks_id_seq;
DROP TABLE IF EXISTS public.fixed_tasks;
DROP SEQUENCE IF EXISTS public.drug_alcohol_test_records_id_seq;
DROP TABLE IF EXISTS public.drug_alcohol_test_records;
DROP TABLE IF EXISTS public.data_masters;
DROP TABLE IF EXISTS public.crew_members;
DROP TABLE IF EXISTS public.company_ranks;
DROP SEQUENCE IF EXISTS public.available_ranks_id_seq;
DROP TABLE IF EXISTS public.available_ranks;
DROP SEQUENCE IF EXISTS public.appraisal_results_id_seq;
DROP TABLE IF EXISTS public.appraisal_results;
DROP SEQUENCE IF EXISTS drizzle.__drizzle_migrations_id_seq;
DROP TABLE IF EXISTS drizzle.__drizzle_migrations;
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS pg_trgm;
-- *not* dropping schema, since initdb creates it
DROP SCHEMA IF EXISTS drizzle;
--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: appraisal_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appraisal_results (
    id integer NOT NULL,
    crew_member_id text NOT NULL,
    form_id integer NOT NULL,
    appraisal_type text NOT NULL,
    appraisal_date text NOT NULL,
    appraisal_data text NOT NULL,
    competence_rating text,
    behavioral_rating text,
    overall_rating text,
    submitted_at timestamp without time zone DEFAULT now(),
    submitted_by text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    stage_statuses text,
    stage_payloads text
);


--
-- Name: appraisal_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appraisal_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appraisal_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appraisal_results_id_seq OWNED BY public.appraisal_results.id;


--
-- Name: available_ranks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.available_ranks (
    id integer NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    rank_id text,
    label text,
    applicable_to_company boolean,
    sort_order integer DEFAULT 0
);


--
-- Name: available_ranks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.available_ranks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: available_ranks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.available_ranks_id_seq OWNED BY public.available_ranks.id;


--
-- Name: company_ranks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_ranks (
    id text NOT NULL,
    rank text NOT NULL,
    rank_id text NOT NULL,
    role text,
    original_rank_id text,
    is_role_row boolean DEFAULT false,
    officer boolean DEFAULT false,
    rating boolean DEFAULT false,
    senior_officer boolean DEFAULT false,
    deck_officer boolean DEFAULT false,
    eng_officer boolean DEFAULT false,
    petty_officer boolean DEFAULT false,
    deck_rating boolean DEFAULT false,
    engine_rating boolean DEFAULT false,
    general_rating boolean DEFAULT false,
    catering_rating boolean DEFAULT false,
    safety_officer boolean DEFAULT false,
    sso boolean DEFAULT false,
    medical_officer boolean DEFAULT false,
    navigating_officer boolean DEFAULT false,
    emt_officer boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: crew_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crew_members (
    id text NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    nationality text NOT NULL,
    vessel_type text NOT NULL,
    sign_on_date text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    emp_no text,
    family_name text,
    date_of_birth text,
    age text,
    present_rank text NOT NULL,
    rank_applied_for text,
    employee_id text,
    present_vessel text NOT NULL,
    last_vessel text,
    status text,
    joining_date text,
    sign_off_date text,
    contract_period text,
    relief_due text,
    reason text,
    availability text,
    email text,
    mobile text,
    contact_landline text,
    country_of_residence text,
    nearest_airport text,
    residential_address_line1 text,
    residential_address_line2 text,
    place_of_birth_city text,
    place_of_birth_country text,
    height_cm text,
    weight_kg text,
    bmi text,
    native_language text,
    foreign_languages text,
    english_proficiency text,
    marital_status text,
    number_of_dependent_children text,
    father_name text,
    mother_name text,
    spouse_first_name text,
    spouse_middle_name text,
    spouse_family_name text,
    spouse_date_of_birth text,
    nok_first_name text,
    nok_middle_name text,
    nok_family_name text,
    nok_telephone text,
    nok_email text,
    nok_address text,
    nok_relationship text,
    manning_agent text,
    vessel_types text,
    documents text,
    visas text,
    education text,
    licenses text,
    training_courses text,
    current_company_sea_service text,
    external_sea_service text,
    pre_joining_medicals text,
    doctor_visits text,
    children text
);


--
-- Name: data_masters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_masters (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: drug_alcohol_test_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_alcohol_test_records (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    test_type text NOT NULL,
    alcohol_drug_type text,
    place_location text,
    date_time_test_completed text,
    external_test_results_date text,
    incident_id text,
    testing_equipment text,
    equipment_not_applicable boolean DEFAULT false,
    test_history text,
    frequency_months integer DEFAULT 12 NOT NULL,
    planned_port text,
    planned_date text,
    planned_comments text,
    incident_title text,
    incident_date_time text,
    alcohol_test_date_time text,
    drug_test_date_time text,
    violations integer DEFAULT 0,
    test_date_time text,
    other_test_type text,
    reason_for_testing text,
    description text,
    initiated_by text,
    personnel_tested text,
    comments text,
    master_deputy_signature text,
    attachment_file text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: drug_alcohol_test_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drug_alcohol_test_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drug_alcohol_test_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drug_alcohol_test_records_id_seq OWNED BY public.drug_alcohol_test_records.id;


--
-- Name: fixed_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_tasks (
    id integer NOT NULL,
    crew_member_id text NOT NULL,
    vessel_id text NOT NULL,
    rank text NOT NULL,
    name text NOT NULL,
    month_year text NOT NULL,
    sea_hours text NOT NULL,
    port_hours text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: fixed_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fixed_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fixed_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fixed_tasks_id_seq OWNED BY public.fixed_tasks.id;


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id integer NOT NULL,
    name text NOT NULL,
    rank_group text NOT NULL,
    version_no text NOT NULL,
    version_date text NOT NULL,
    configuration text,
    category text DEFAULT 'appraisal'::text NOT NULL
);


--
-- Name: forms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.forms_id_seq OWNED BY public.forms.id;


--
-- Name: id_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.id_counters (
    id integer NOT NULL,
    counter_type text NOT NULL,
    current_value integer DEFAULT 0 NOT NULL,
    prefix text NOT NULL,
    format text DEFAULT '000000'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: id_counters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.id_counters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: id_counters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.id_counters_id_seq OWNED BY public.id_counters.id;


--
-- Name: master_data_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_data_entries (
    id integer NOT NULL,
    master_id text NOT NULL,
    entry_id text NOT NULL,
    nuid text,
    name text NOT NULL,
    description text,
    "countryName" text,
    country text,
    cid text,
    "countryCode" text,
    nationality text,
    "countryRefId" text,
    vtuid text,
    "vesselType" text,
    tanker boolean DEFAULT false,
    "oilTanker" boolean DEFAULT false,
    "gasTanker" boolean DEFAULT false,
    "chemicalTanker" boolean DEFAULT false,
    bulk boolean DEFAULT false,
    "isActive" boolean DEFAULT true,
    "isDeleted" boolean DEFAULT false,
    "createdBy" text,
    domain text,
    "orderBy" integer,
    fuid text,
    "managerId" text,
    aguid text,
    "userId" text,
    "vesselIds" text,
    vouid text,
    address text,
    email text,
    phone text,
    company text,
    "nameOfContactPerson" text,
    duid text,
    "shortCode" text,
    type text,
    department text,
    uuid text,
    lastname text,
    firstname text,
    "addressLine1" text,
    "addressLine2" text,
    "addressLine3" text,
    city text,
    state text,
    zipcode text,
    "loginId" text,
    "roleId" text,
    "designationId" text,
    "profilePic" text,
    "userType" text,
    "departmentId" text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: master_data_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_data_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_data_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_data_entries_id_seq OWNED BY public.master_data_entries.id;


--
-- Name: nc_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nc_reports (
    id integer NOT NULL,
    crew_member_id text NOT NULL,
    vessel_id text NOT NULL,
    rank text NOT NULL,
    month_value text NOT NULL,
    nc_reference text DEFAULT 'STCW/MLC/ILO'::text NOT NULL,
    identified_root_cause text,
    immediate_corrective_action text,
    preventive_action text,
    preventive_action_status text DEFAULT 'Pending'::text NOT NULL,
    preventive_action_due_date timestamp without time zone,
    preventive_action_date_completed timestamp without time zone,
    office_closure_verified_by_name text,
    office_closure_verified_by_position text,
    office_closure_date timestamp without time zone,
    status text DEFAULT 'Open'::text NOT NULL,
    submission_status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: nc_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nc_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nc_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nc_reports_id_seq OWNED BY public.nc_reports.id;


--
-- Name: office_violation_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_violation_comments (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    month_value text NOT NULL,
    comment text,
    reviewer_name text,
    reviewer_position text,
    review_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: office_violation_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.office_violation_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: office_violation_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.office_violation_comments_id_seq OWNED BY public.office_violation_comments.id;


--
-- Name: promotion_hierarchies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_hierarchies (
    id integer NOT NULL,
    group_name text NOT NULL,
    rank_path text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: promotion_hierarchies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotion_hierarchies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotion_hierarchies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotion_hierarchies_id_seq OWNED BY public.promotion_hierarchies.id;


--
-- Name: rank_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rank_groups (
    id integer NOT NULL,
    form_id integer NOT NULL,
    name text NOT NULL,
    ranks text NOT NULL
);


--
-- Name: rank_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rank_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rank_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rank_groups_id_seq OWNED BY public.rank_groups.id;


--
-- Name: recruitment_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recruitment_candidates (
    id text NOT NULL,
    file_no text NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    family_name text NOT NULL,
    dob text NOT NULL,
    nationality text NOT NULL,
    rank_applied_for text NOT NULL,
    present_rank text NOT NULL,
    vessel_type text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    application_data text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rest_hours_crew_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rest_hours_crew_records (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    vessel_name text NOT NULL,
    crew_member_id text NOT NULL,
    rank text NOT NULL,
    name text NOT NULL,
    month text NOT NULL,
    month_value text NOT NULL,
    sign_on_off_info text,
    recording_status_percent integer DEFAULT 0 NOT NULL,
    activity_conflicting boolean DEFAULT false NOT NULL,
    total_violations integer DEFAULT 0 NOT NULL,
    total_ncs integer DEFAULT 0 NOT NULL,
    predicted_violations integer DEFAULT 0 NOT NULL,
    predicted_ncs integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rest_hours_crew_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rest_hours_crew_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rest_hours_crew_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rest_hours_crew_records_id_seq OWNED BY public.rest_hours_crew_records.id;


--
-- Name: rest_hours_daily_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rest_hours_daily_records (
    id integer NOT NULL,
    crew_member_id text NOT NULL,
    vessel_id text NOT NULL,
    rank text NOT NULL,
    name text NOT NULL,
    month_year text NOT NULL,
    daily_records text NOT NULL,
    show_planning boolean DEFAULT false,
    opa_mode boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rest_hours_daily_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rest_hours_daily_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rest_hours_daily_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rest_hours_daily_records_id_seq OWNED BY public.rest_hours_daily_records.id;


--
-- Name: rest_hours_vessel_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rest_hours_vessel_records (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    vessel_name text NOT NULL,
    month text NOT NULL,
    month_value text NOT NULL,
    total_crew integer DEFAULT 0 NOT NULL,
    recording_status_percent integer DEFAULT 0 NOT NULL,
    activity_conflicting boolean DEFAULT false NOT NULL,
    crew_with_activity_conflicts integer DEFAULT 0 NOT NULL,
    crew_with_activity_conflicts_details text,
    total_violations integer DEFAULT 0 NOT NULL,
    crew_with_violations integer DEFAULT 0 NOT NULL,
    crew_with_violations_details text,
    total_ncs integer DEFAULT 0 NOT NULL,
    crew_with_ncs integer DEFAULT 0 NOT NULL,
    crew_with_ncs_details text,
    predicted_violations integer DEFAULT 0 NOT NULL,
    crew_with_predicted_violations integer DEFAULT 0 NOT NULL,
    crew_with_predicted_violations_details text,
    predicted_ncs integer DEFAULT 0 NOT NULL,
    crew_with_predicted_ncs integer DEFAULT 0 NOT NULL,
    crew_with_predicted_ncs_details text,
    vessel_review_status text DEFAULT 'Due'::text NOT NULL,
    vessel_review_submitted_date timestamp without time zone,
    office_review_status text DEFAULT 'Due'::text NOT NULL,
    office_review_submitted_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rest_hours_vessel_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rest_hours_vessel_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rest_hours_vessel_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rest_hours_vessel_records_id_seq OWNED BY public.rest_hours_vessel_records.id;


--
-- Name: revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revisions (
    id integer NOT NULL,
    vessel_id integer NOT NULL,
    revision_no text NOT NULL,
    flex_date text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.revisions_id_seq OWNED BY public.revisions.id;


--
-- Name: rotation_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rotation_plans (
    id integer NOT NULL,
    draft_id text NOT NULL,
    last_edited text NOT NULL,
    vessels text NOT NULL,
    crew text NOT NULL,
    plan_from_date text NOT NULL,
    plan_to_date text NOT NULL,
    created_by text NOT NULL,
    plan_status text DEFAULT 'In Draft'::text NOT NULL,
    proposed_by text,
    proposed_date text,
    assignments text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: rotation_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rotation_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rotation_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rotation_plans_id_seq OWNED BY public.rotation_plans.id;


--
-- Name: seafarers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seafarers (
    id integer NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    last_name text NOT NULL,
    rank text NOT NULL,
    nationality text NOT NULL,
    status text DEFAULT 'Available'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: seafarers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seafarers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seafarers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seafarers_id_seq OWNED BY public.seafarers.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: variable_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variable_tasks (
    id integer NOT NULL,
    start_date_time text NOT NULL,
    finish_date_time text NOT NULL,
    start_date_time_sort text NOT NULL,
    finish_date_time_sort text NOT NULL,
    task text NOT NULL,
    status text NOT NULL,
    crew_involved integer NOT NULL,
    remarks text,
    period_value text,
    vessel_id text,
    is_draft boolean DEFAULT true NOT NULL,
    record_type text NOT NULL,
    status_type text NOT NULL,
    selected_tasks text,
    other_task text,
    crew_involved_details text,
    comments text
);


--
-- Name: variable_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.variable_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: variable_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.variable_tasks_id_seq OWNED BY public.variable_tasks.id;


--
-- Name: vessel_dateline_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_dateline_adjustments (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    month_value text NOT NULL,
    adjustments text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_dateline_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_dateline_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_dateline_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_dateline_adjustments_id_seq OWNED BY public.vessel_dateline_adjustments.id;


--
-- Name: vessel_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_drafts (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    revision text DEFAULT 'R1'::text NOT NULL,
    draft_data text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_drafts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_drafts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_drafts_id_seq OWNED BY public.vessel_drafts.id;


--
-- Name: vessel_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_groups (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    vessel_ids text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_groups_id_seq OWNED BY public.vessel_groups.id;


--
-- Name: vessel_planning; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_planning (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    rank_id text NOT NULL,
    rank text NOT NULL,
    crew_member_id text,
    on_board_crew_id text,
    on_board_crew_name text,
    on_board_crew_nationality text,
    relief_due text,
    sign_off_date text,
    sign_off_port text,
    relief_status text,
    reliever_crew_id text,
    reliever_crew_name text,
    reliever_nationality text,
    joining_date text,
    joining_port text,
    joining_status text,
    contract_period_months integer,
    contract_end_range_start_months integer,
    contract_end_range_end_months integer,
    deployment_checklist_completed boolean,
    applicable_docs_checked boolean,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_planning_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_planning_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_planning_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_planning_id_seq OWNED BY public.vessel_planning.id;


--
-- Name: vessel_ranks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_ranks (
    id integer NOT NULL,
    vessel_id integer NOT NULL,
    revision_id integer NOT NULL,
    rank text NOT NULL,
    rank_id text NOT NULL,
    role text,
    original_rank_id text,
    is_role_row boolean DEFAULT false,
    officer boolean DEFAULT false,
    rating boolean DEFAULT false,
    senior_officer boolean DEFAULT false,
    deck_officer boolean DEFAULT false,
    eng_officer boolean DEFAULT false,
    petty_officer boolean DEFAULT false,
    deck_rating boolean DEFAULT false,
    engine_rating boolean DEFAULT false,
    general_rating boolean DEFAULT false,
    catering_rating boolean DEFAULT false,
    safety_officer boolean DEFAULT false,
    sso boolean DEFAULT false,
    medical_officer boolean DEFAULT false,
    navigating_officer boolean DEFAULT false,
    emt_officer boolean DEFAULT false,
    actual_manning text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_ranks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_ranks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_ranks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_ranks_id_seq OWNED BY public.vessel_ranks.id;


--
-- Name: vessel_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_revisions (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    revision text NOT NULL,
    revision_date text NOT NULL,
    revision_data text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_revisions_id_seq OWNED BY public.vessel_revisions.id;


--
-- Name: vessel_violation_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessel_violation_comments (
    id integer NOT NULL,
    vessel_id text NOT NULL,
    month_value text NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessel_violation_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessel_violation_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessel_violation_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessel_violation_comments_id_seq OWNED BY public.vessel_violation_comments.id;


--
-- Name: vessels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vessels (
    id integer NOT NULL,
    name text NOT NULL,
    vessel_group text,
    vessel_type text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: vessels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vessels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vessels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vessels_id_seq OWNED BY public.vessels.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: appraisal_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_results ALTER COLUMN id SET DEFAULT nextval('public.appraisal_results_id_seq'::regclass);


--
-- Name: available_ranks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.available_ranks ALTER COLUMN id SET DEFAULT nextval('public.available_ranks_id_seq'::regclass);


--
-- Name: drug_alcohol_test_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_alcohol_test_records ALTER COLUMN id SET DEFAULT nextval('public.drug_alcohol_test_records_id_seq'::regclass);


--
-- Name: fixed_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_tasks ALTER COLUMN id SET DEFAULT nextval('public.fixed_tasks_id_seq'::regclass);


--
-- Name: forms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms ALTER COLUMN id SET DEFAULT nextval('public.forms_id_seq'::regclass);


--
-- Name: id_counters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.id_counters ALTER COLUMN id SET DEFAULT nextval('public.id_counters_id_seq'::regclass);


--
-- Name: master_data_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_entries ALTER COLUMN id SET DEFAULT nextval('public.master_data_entries_id_seq'::regclass);


--
-- Name: nc_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nc_reports ALTER COLUMN id SET DEFAULT nextval('public.nc_reports_id_seq'::regclass);


--
-- Name: office_violation_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_violation_comments ALTER COLUMN id SET DEFAULT nextval('public.office_violation_comments_id_seq'::regclass);


--
-- Name: promotion_hierarchies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_hierarchies ALTER COLUMN id SET DEFAULT nextval('public.promotion_hierarchies_id_seq'::regclass);


--
-- Name: rank_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_groups ALTER COLUMN id SET DEFAULT nextval('public.rank_groups_id_seq'::regclass);


--
-- Name: rest_hours_crew_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_crew_records ALTER COLUMN id SET DEFAULT nextval('public.rest_hours_crew_records_id_seq'::regclass);


--
-- Name: rest_hours_daily_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_daily_records ALTER COLUMN id SET DEFAULT nextval('public.rest_hours_daily_records_id_seq'::regclass);


--
-- Name: rest_hours_vessel_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_vessel_records ALTER COLUMN id SET DEFAULT nextval('public.rest_hours_vessel_records_id_seq'::regclass);


--
-- Name: revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisions ALTER COLUMN id SET DEFAULT nextval('public.revisions_id_seq'::regclass);


--
-- Name: rotation_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotation_plans ALTER COLUMN id SET DEFAULT nextval('public.rotation_plans_id_seq'::regclass);


--
-- Name: seafarers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seafarers ALTER COLUMN id SET DEFAULT nextval('public.seafarers_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: variable_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variable_tasks ALTER COLUMN id SET DEFAULT nextval('public.variable_tasks_id_seq'::regclass);


--
-- Name: vessel_dateline_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_dateline_adjustments ALTER COLUMN id SET DEFAULT nextval('public.vessel_dateline_adjustments_id_seq'::regclass);


--
-- Name: vessel_drafts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_drafts ALTER COLUMN id SET DEFAULT nextval('public.vessel_drafts_id_seq'::regclass);


--
-- Name: vessel_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_groups ALTER COLUMN id SET DEFAULT nextval('public.vessel_groups_id_seq'::regclass);


--
-- Name: vessel_planning id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_planning ALTER COLUMN id SET DEFAULT nextval('public.vessel_planning_id_seq'::regclass);


--
-- Name: vessel_ranks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_ranks ALTER COLUMN id SET DEFAULT nextval('public.vessel_ranks_id_seq'::regclass);


--
-- Name: vessel_revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_revisions ALTER COLUMN id SET DEFAULT nextval('public.vessel_revisions_id_seq'::regclass);


--
-- Name: vessel_violation_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_violation_comments ALTER COLUMN id SET DEFAULT nextval('public.vessel_violation_comments_id_seq'::regclass);


--
-- Name: vessels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessels ALTER COLUMN id SET DEFAULT nextval('public.vessels_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: appraisal_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appraisal_results (id, crew_member_id, form_id, appraisal_type, appraisal_date, appraisal_data, competence_rating, behavioral_rating, overall_rating, submitted_at, submitted_by, status, stage_statuses, stage_payloads) FROM stdin;
\.


--
-- Data for Name: available_ranks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.available_ranks (id, name, category, rank_id, label, applicable_to_company, sort_order) FROM stdin;
1	Master	Senior Officers	S1	Master	t	1
2	Chief Officer	Senior Officers	S2	Chief Officer	t	2
3	Chief Engineer	Senior Officers	S7	Chief Engineer	t	5
4	2nd Officer	Senior Officers	S3	2nd Officer	t	3
5	3rd Officer	Senior Officers	S4	3rd Officer	t	4
6	2nd Engineer	Junior Officers	S9	2nd Engineer	t	6
7	3rd Engineer	Junior Officers	S10	3rd Engineer	t	7
8	Bosun	Ratings	S12	Bosun	t	10
9	AB	Ratings	S14	AB	t	12
10	OS	Senior Officers	S15	OS	t	13
11	4th Engineer	Senior Officers	S16	4th Engineer	t	8
12	Fitter	Senior Officers	S17	Fitter	t	14
13	Oiler	Senior Officers	S18	Oiler	t	15
14	Chief Cook	Senior Officers	S19	Chief Cook	t	16
15	Messman	Senior Officers	S20	Messman	t	17
16	Electrical Officer	Senior Officers	S21	Electrical Officer	t	9
17	Pumpman	Senior Officers	S21	Pumpman	t	11
19	ttl	Senior Officers	tt	tl	t	0
20	boss	Senior Officers	program manager	top level 	t	0
\.


--
-- Data for Name: company_ranks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.company_ranks (id, rank, rank_id, role, original_rank_id, is_role_row, officer, rating, senior_officer, deck_officer, eng_officer, petty_officer, deck_rating, engine_rating, general_rating, catering_rating, safety_officer, sso, medical_officer, navigating_officer, emt_officer, created_at, updated_at) FROM stdin;
1	Master	S1	\N	\N	f	t	f	f	f	f	f	f	f	f	f	f	t	f	f	f	2025-11-13 13:04:18.605163	2025-11-13 13:04:18.605163
2	Chief Officer	S2	\N	\N	f	t	f	t	t	f	f	f	f	f	f	t	f	f	f	f	2025-11-13 13:04:18.849575	2025-11-13 13:04:18.849575
4	2nd Officer	S3	\N	\N	f	t	f	f	t	f	f	f	f	f	f	f	f	t	t	f	2025-11-13 13:04:19.084946	2025-11-13 13:04:19.084946
5	3rd Officer	S4	\N	\N	f	t	f	f	t	f	f	f	f	f	f	f	f	f	t	f	2025-11-13 13:04:19.318832	2025-11-13 13:04:19.318832
5_role_1_1759121177041	3rd Officer	S4	3rd Officer_1	5	t	t	f	f	t	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:19.553032	2025-11-13 13:04:19.553032
5_role_2_1759121177041	3rd Officer	S4	3rd Officer_2	5	t	t	f	f	t	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:19.788768	2025-11-13 13:04:19.788768
3	Chief Engineer	S7	\N	\N	f	t	f	f	f	t	f	f	f	f	f	f	f	f	f	t	2025-11-13 13:04:20.024987	2025-11-13 13:04:20.024987
6	2nd Engineer	S9	\N	\N	f	t	f	f	f	t	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:20.259331	2025-11-13 13:04:20.259331
7	3rd Engineer	S10	\N	\N	f	t	f	f	f	t	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:20.493826	2025-11-13 13:04:20.493826
11	4th Engineer	S16	\N	\N	f	t	f	f	f	t	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:20.727863	2025-11-13 13:04:20.727863
16	Electrical Officer	S21	\N	\N	f	t	f	f	f	t	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:20.962973	2025-11-13 13:04:20.962973
8	Bosun	S12	\N	\N	f	f	t	f	f	f	t	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:21.197016	2025-11-13 13:04:21.197016
17	Pumpman	S21	\N	\N	f	f	t	f	f	f	t	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:21.431658	2025-11-13 13:04:21.431658
9	AB	S14	\N	\N	f	f	t	f	f	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:21.66564	2025-11-13 13:04:21.66564
9_role_1_1759121189124	AB	S14	AB_1	9	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:21.900529	2025-11-13 13:04:21.900529
9_role_2_1759121189124	AB	S14	AB_2	9	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:22.135637	2025-11-13 13:04:22.135637
9_role_3_1759121190062	AB	S14	AB_3	9	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:22.371002	2025-11-13 13:04:22.371002
9_role_4_1759121190874	AB	S14	AB_4	9	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:22.605253	2025-11-13 13:04:22.605253
10	OS	S15	\N	\N	f	f	t	f	f	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:22.839478	2025-11-13 13:04:22.839478
10_role_1_1759121194827	OS	S15	OS_1	10	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:23.073666	2025-11-13 13:04:23.073666
10_role_2_1759121194827	OS	S15	OS_2	10	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:23.30751	2025-11-13 13:04:23.30751
10_role_3_1759121195540	OS	S15	OS_3	10	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:23.541993	2025-11-13 13:04:23.541993
10_role_4_1759121195962	OS	S15	OS_4	10	t	f	t	f	f	f	f	t	f	f	f	f	f	f	f	f	2025-11-13 13:04:23.776148	2025-11-13 13:04:23.776148
12	Fitter	S17	\N	\N	f	f	t	f	f	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:24.010133	2025-11-13 13:04:24.010133
12_role_1_1759121198960	Fitter	S17	Fitter_1	12	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:24.247735	2025-11-13 13:04:24.247735
12_role_2_1759121198960	Fitter	S17	Fitter_2	12	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:24.482854	2025-11-13 13:04:24.482854
13	Oiler	S18	\N	\N	f	f	t	f	f	f	f	f	f	f	f	f	f	f	f	f	2025-11-13 13:04:24.717213	2025-11-13 13:04:24.717213
13_role_1_1759121201260	Oiler	S18	Oiler_1	13	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:24.951647	2025-11-13 13:04:24.951647
13_role_2_1759121201260	Oiler	S18	Oiler_2	13	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:25.185481	2025-11-13 13:04:25.185481
13_role_3_1759121202011	Oiler	S18	Oiler_3	13	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:25.419858	2025-11-13 13:04:25.419858
13_role_4_1759121202490	Oiler	S18	Oiler_4	13	t	f	t	f	f	f	f	f	t	f	f	f	f	f	f	f	2025-11-13 13:04:25.65507	2025-11-13 13:04:25.65507
14	Chief Cook	S19	\N	\N	f	f	t	f	f	f	f	f	f	f	t	f	f	f	f	f	2025-11-13 13:04:25.889178	2025-11-13 13:04:25.889178
15	Messman	S20	\N	\N	f	f	t	f	f	f	f	f	f	f	t	f	f	f	f	f	2025-11-13 13:04:26.123614	2025-11-13 13:04:26.123614
\.


--
-- Data for Name: crew_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crew_members (id, first_name, middle_name, nationality, vessel_type, sign_on_date, created_at, updated_at, emp_no, family_name, date_of_birth, age, present_rank, rank_applied_for, employee_id, present_vessel, last_vessel, status, joining_date, sign_off_date, contract_period, relief_due, reason, availability, email, mobile, contact_landline, country_of_residence, nearest_airport, residential_address_line1, residential_address_line2, place_of_birth_city, place_of_birth_country, height_cm, weight_kg, bmi, native_language, foreign_languages, english_proficiency, marital_status, number_of_dependent_children, father_name, mother_name, spouse_first_name, spouse_middle_name, spouse_family_name, spouse_date_of_birth, nok_first_name, nok_middle_name, nok_family_name, nok_telephone, nok_email, nok_address, nok_relationship, manning_agent, vessel_types, documents, visas, education, licenses, training_courses, current_company_sea_service, external_sea_service, pre_joining_medicals, doctor_visits, children) FROM stdin;
2025-05-14	James	Michael	British		\N	2025-02-01 00:00:00	2025-02-01 00:00:00	A000001	Wilson	1973-09-09	\N	Master	\N	A000001		\N	Active	\N	\N	\N	\N	\N	Available	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	"[{\\"id\\":\\"1\\",\\"document\\":\\"\\",\\"number\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"issuingAuthority\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"issuingCountry\\":\\"\\",\\"serialNo\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"visaType\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"dateOfCompletion\\":\\"\\",\\"schoolCollegeUniversity\\":\\"\\",\\"subjectsField\\":\\"\\",\\"qualifications\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"certificateDocument\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"trainingCourse\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[{\\"id\\":\\"1760341062230\\",\\"vessel\\":\\"M.T. SAIL\\",\\"dateOfMedical\\":\\"2025-10-14\\",\\"bp\\":\\"\\",\\"weight\\":\\"95\\",\\"anyMedicationPrescribed\\":\\"None\\",\\"fitnessForDuty\\":\\"\\",\\"expiry\\":\\"2026-03-19\\"}]"	"[]"	"[]"
2025-03-12	Anna	Marie	British		\N	2025-01-01 00:00:00	2025-01-01 00:00:00	\N	Johnson	1981-03-31	\N	Chief Engineer	\N	A000002	VSL-005	\N	On Board	2025-05-01T00:00:00.000+00:00	\N	6 months	2025-11-01T00:00:00.000+00:00	\N	Available	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	"[{\\"id\\":\\"1\\",\\"document\\":\\"\\",\\"number\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"issuingAuthority\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"issuingCountry\\":\\"\\",\\"serialNo\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"visaType\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"dateOfCompletion\\":\\"\\",\\"schoolCollegeUniversity\\":\\"\\",\\"subjectsField\\":\\"\\",\\"qualifications\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"certificateDocument\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"trainingCourse\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[]"	"[]"	"[]"
A000264	John	\N	Filipino		\N	2025-11-13 13:04:36.893264	2025-11-13 13:04:36.893264	A000263	Fiddich	1981-03-03	\N	Master	\N	A000263	VSL-003	\N	On Board	2025-08-15T00:00:00.000+00:00	\N	5 months	2026-02-15T00:00:00.000+00:00	\N	Available	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	"[{\\"id\\":\\"1\\",\\"document\\":\\"\\",\\"number\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"issuingAuthority\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"issuingCountry\\":\\"\\",\\"serialNo\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\",\\"visaType\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"dateOfCompletion\\":\\"\\",\\"schoolCollegeUniversity\\":\\"\\",\\"subjectsField\\":\\"\\",\\"qualifications\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"certificateDocument\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"trainingCourse\\":\\"\\",\\"abbr\\":\\"\\",\\"requirement\\":\\"\\",\\"certificateNo\\":\\"\\",\\"issuingAuthority\\":\\"\\",\\"issued\\":\\"\\",\\"expiry\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[{\\"id\\":\\"1\\",\\"vesselName\\":\\"\\",\\"vesselType\\":\\"\\",\\"deadweight\\":\\"\\",\\"engineTypePower\\":\\"\\",\\"ownerOperator\\":\\"\\",\\"rank\\":\\"\\",\\"from\\":\\"\\",\\"to\\":\\"\\",\\"periodMonths\\":\\"\\"}]"	"[]"	"[]"	"[]"
A000278	Gheorghe	\N	Romanian	Container Ship	\N	2025-11-13 13:04:49.301346	2025-11-13 13:04:49.301346	\N	Popescu	1973-01-17	52	Chief Officer	\N	A000277	VSL-005	\N	On Board	2025-04-10T00:00:00.000+00:00	\N	6 months	2025-10-10T00:00:00.000+00:00	\N	\N	crew17594708856035624@seafarer.com	+82-505-4120138	\N	\N	\N	\N	\N	\N	\N	165	65	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000280	Wang	\N	Chinese	Chemical Tanker	\N	2025-11-13 13:04:49.547134	2025-11-13 13:04:49.547134	\N	Zhao	1987-07-20	38	Chief Officer	\N	A000279	VSL-003	\N	On Board	2025-06-20T00:00:00.000+00:00	\N	6 months	2025-12-20T00:00:00.000+00:00	\N	\N	crew17594708857082810@seafarer.com	+40-359-8477419	\N	\N	\N	\N	\N	\N	\N	169	70	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000290	Constantin	\N	Romanian	Oil Tanker	\N	2025-11-13 13:04:56.500723	2025-11-13 13:04:56.500723	\N	Popa	1974-10-06	51	Chief Engineer	\N	A000289	VSL-003	\N	On Board	2025-05-02T00:00:00.000+00:00	\N	\N	2026-02-02T00:00:00.000+00:00	\N	\N	crew17594708862395002@seafarer.com	+65-895-2697379	\N	\N	\N	\N	\N	\N	\N	165	78	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000302	Panagiotis	\N	Greek	Bulk Carrier	\N	2025-11-13 13:05:05.112043	2025-11-13 13:05:05.112043	\N	Petrou	1980-09-15	45	2nd Officer	\N	A000301	VSL-005	\N	On Board	2025-04-25T00:00:00.000+00:00	\N	\N	2025-10-25T00:00:00.000+00:00	\N	\N	crew17594708868712429@seafarer.com	+92-503-3145310	\N	\N	\N	\N	\N	\N	\N	181	74	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000304	Piotr	\N	Polish	Oil Tanker	\N	2025-11-13 13:05:05.37097	2025-11-13 13:05:05.37097	\N	Nowak	1995-11-24	30	2nd Officer	\N	A000303	VSL-003	\N	On Board	2025-05-15T00:00:00.000+00:00	\N	\N	2025-11-15T00:00:00.000+00:00	\N	\N	crew17594708869743721@seafarer.com	+2-787-5117052	\N	\N	\N	\N	\N	\N	\N	180	73	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000314	Lars	\N	Norwegian	Bulk Carrier	\N	2025-11-13 13:05:12.296337	2025-11-13 13:05:12.296337	\N	Larsen	1985-05-20	40	3rd Officer_1	\N	A000313	VSL-005	\N	On Board	2025-06-01T00:00:00.000+00:00	\N	\N	2025-12-01T00:00:00.000+00:00	\N	\N	crew17594708874933885@seafarer.com	+82-179-9307933	\N	\N	\N	\N	\N	\N	\N	180	87	\N	\N	\N	Excellent	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000316	Bjorn	\N	Norwegian	Oil Tanker	\N	2025-11-13 13:05:12.540839	2025-11-13 13:05:12.540839	\N	Hansen	2000-08-05	25	3rd Officer_2	\N	A000315	VSL-005	\N	On Board	2025-06-15T00:00:00.000+00:00	\N	\N	2025-12-15T00:00:00.000+00:00	\N	\N	crew17594708875971637@seafarer.com	+83-953-3995832	\N	\N	\N	\N	\N	\N	\N	166	80	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000318	Wang	\N	Chinese	Bulk Carrier	\N	2025-11-13 13:05:12.780606	2025-11-13 13:05:12.780606	\N	Liu	1994-03-04	31	3rd Officer_1	\N	A000317	VSL-003	\N	On Board	2025-06-05T00:00:00.000+00:00	\N	\N	2025-12-05T00:00:00.000+00:00	\N	\N	crew17594708877011882@seafarer.com	+35-365-9364822	\N	\N	\N	\N	\N	\N	\N	182	71	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000320	Pawel	\N	Polish	Container Ship	\N	2025-11-13 13:05:13.020464	2025-11-13 13:05:13.020464	\N	Nowak	1996-03-06	29	3rd Officer_2	\N	A000319	VSL-003	\N	On Board	2025-08-16T00:00:00.000+00:00	\N	\N	2026-04-16T00:00:00.000+00:00	\N	\N	crew17594708878053013@seafarer.com	+58-887-2475703	\N	\N	\N	\N	\N	\N	\N	176	70	\N	\N	\N	Good	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000326	Anil	\N	Indian	Container Ship	\N	2025-11-13 13:05:16.519871	2025-11-13 13:05:16.519871	\N	Reddy	1986-09-22	39	2nd Engineer	\N	A000325	VSL-005	\N	On Board	2025-06-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708881205853@seafarer.com	+32-553-7041610	\N	\N	\N	\N	\N	\N	\N	178	84	\N	\N	\N	Excellent	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000328	Georgios	\N	Greek	Oil Tanker	\N	2025-11-13 13:05:16.760533	2025-11-13 13:05:16.760533	\N	Dimitriou	1982-10-16	43	2nd Engineer	\N	A000327	VSL-003	\N	On Board	2025-04-15T00:00:00.000+00:00	\N	\N	2025-12-15T00:00:00.000+00:00	\N	\N	crew17594708882236196@seafarer.com	+73-703-3745508	\N	\N	\N	\N	\N	\N	\N	166	65	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000338	Wang	\N	Chinese	Oil Tanker	\N	2025-11-13 13:05:23.710705	2025-11-13 13:05:23.710705	\N	Liu	1979-06-16	46	3rd Engineer	\N	A000337	VSL-005	\N	On Board	2025-07-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708887389296@seafarer.com	+28-463-7583171	\N	\N	\N	\N	\N	\N	\N	185	70	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000340	Knut	\N	Norwegian	Chemical Tanker	\N	2025-11-13 13:05:23.951963	2025-11-13 13:05:23.951963	\N	Olsen	1991-12-01	34	3rd Engineer	\N	A000339	VSL-003	\N	On Board	2025-04-24T00:00:00.000+00:00	\N	\N	2025-12-24T00:00:00.000+00:00	\N	\N	crew17594708888427874@seafarer.com	+86-597-1743029	\N	\N	\N	\N	\N	\N	\N	167	70	\N	\N	\N	Excellent	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000350	Adrian	\N	Romanian	Bulk Carrier	\N	2025-11-13 13:05:30.858759	2025-11-13 13:05:30.858759	\N	Dumitrescu	1989-04-01	36	Bosun	\N	A000349	VSL-005	\N	On Board	2025-03-01T00:00:00.000+00:00	\N	\N	2025-12-01T00:00:00.000+00:00	\N	\N	crew17594708893581769@seafarer.com	+39-617-4373080	\N	\N	\N	\N	\N	\N	\N	178	65	\N	\N	\N	Good	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000352	Tomasz	\N	Polish	Oil Tanker	\N	2025-11-13 13:05:31.099426	2025-11-13 13:05:31.099426	\N	Kowalski	1974-02-17	51	Bosun	\N	A000351	VSL-003	\N	On Board	2025-06-05T00:00:00.000+00:00	\N	\N	2026-03-05T00:00:00.000+00:00	\N	\N	crew17594708894612451@seafarer.com	+77-616-5554675	\N	\N	\N	\N	\N	\N	\N	184	81	\N	\N	\N	Fair	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000362	Kumar	\N	Indian	Oil Tanker	\N	2025-11-13 13:05:38.026153	2025-11-13 13:05:38.026153	\N	Nair	1973-07-08	52	AB_1	\N	A000361	VSL-005	\N	On Board	2025-04-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708899758967@seafarer.com	+98-299-5042105	\N	\N	\N	\N	\N	\N	\N	175	86	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000364	Zhang	\N	Chinese	Bulk Carrier	\N	2025-11-13 13:05:38.269696	2025-11-13 13:05:38.269696	\N	Liu	1986-02-04	39	AB_2	\N	A000363	VSL-005	\N	On Board	2025-05-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708900822395@seafarer.com	+66-615-4139226	\N	\N	\N	\N	\N	\N	\N	181	84	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000366	Jan	\N	Polish	Bulk Carrier	\N	2025-11-13 13:05:38.5083	2025-11-13 13:05:38.5083	\N	Kowalski	1981-06-20	44	AB_3	\N	A000365	VSL-005	\N	On Board	2025-06-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708901853434@seafarer.com	+72-959-3970222	\N	\N	\N	\N	\N	\N	\N	180	76	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000368	Oleksandr	\N	Ukrainian	Oil Tanker	\N	2025-11-13 13:05:38.748155	2025-11-13 13:05:38.748155	\N	Bondarenko	1980-05-24	45	AB_1	\N	A000367	VSL-003	\N	On Board	2025-07-31T00:00:00.000+00:00	\N	\N	2026-03-31T00:00:00.000+00:00	\N	\N	crew17594708902886665@seafarer.com	+22-878-7828434	\N	\N	\N	\N	\N	\N	\N	168	83	\N	\N	\N	Fair	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000370	Pedro	\N	Filipino	Oil Tanker	\N	2025-11-13 13:05:38.987255	2025-11-13 13:05:38.987255	\N	Reyes	1997-06-25	28	AB_3	\N	A000369	VSL-003	\N	On Board	2025-05-08T00:00:00.000+00:00	\N	\N	2026-02-08T00:00:00.000+00:00	\N	\N	crew17594708903913668@seafarer.com	+50-951-4299376	\N	\N	\N	\N	\N	\N	\N	169	87	\N	\N	\N	Fair	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000372	Tomasz	\N	Polish	Bulk Carrier	\N	2025-11-13 13:05:39.228887	2025-11-13 13:05:39.228887	\N	Zielinski	1986-06-17	39	AB_2	\N	A000371	VSL-003	\N	On Board	2025-07-09T00:00:00.000+00:00	\N	\N	2026-02-09T00:00:00.000+00:00	\N	\N	crew17594708904946928@seafarer.com	+28-801-4145595	\N	\N	\N	\N	\N	\N	\N	167	87	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000392	Ivan	\N	Ukrainian	Oil Tanker	\N	2025-11-13 13:05:54.609304	2025-11-13 13:05:54.609304	\N	Petrenko	1991-08-08	34	OS_1	\N	A000391	VSL-005	\N	On Board	2025-03-15T00:00:00.000+00:00	\N	\N	2025-12-15T00:00:00.000+00:00	\N	\N	crew17594708915272975@seafarer.com	+97-895-8790358	\N	\N	\N	\N	\N	\N	\N	176	66	\N	\N	\N	Good	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000394	Andriy	\N	Ukrainian	Bulk Carrier	\N	2025-11-13 13:05:54.845856	2025-11-13 13:05:54.845856	\N	Kovalenko	1994-04-07	31	OS_2	\N	A000393	VSL-005	\N	On Board	2025-03-01T00:00:00.000+00:00	\N	\N	2025-12-01T00:00:00.000+00:00	\N	\N	crew17594708916307678@seafarer.com	+65-431-8575606	\N	\N	\N	\N	\N	\N	\N	183	75	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000396	Piotr	\N	Polish	Bulk Carrier	\N	2025-11-13 13:05:55.082053	2025-11-13 13:05:55.082053	\N	Zielinski	1988-02-19	37	OS_3	\N	A000395	VSL-005	\N	On Board	2025-04-15T00:00:00.000+00:00	\N	\N	2026-01-15T00:00:00.000+00:00	\N	\N	crew17594708917334165@seafarer.com	+18-321-1030570	\N	\N	\N	\N	\N	\N	\N	170	85	\N	\N	\N	Good	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000398	Vasile	\N	Romanian	Oil Tanker	\N	2025-11-13 13:05:55.318916	2025-11-13 13:05:55.318916	\N	Dumitrescu	1992-05-19	33	OS_3	\N	A000397	VSL-003	\N	On Board	2025-05-22T00:00:00.000+00:00	\N	\N	2026-01-22T00:00:00.000+00:00	\N	\N	crew17594708918375761@seafarer.com	+38-556-2844685	\N	\N	\N	\N	\N	\N	\N	183	74	\N	\N	\N	Excellent	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000400	Agus	\N	Indonesian	Oil Tanker	\N	2025-11-13 13:05:55.554831	2025-11-13 13:05:55.554831	\N	Gunawan	1997-04-18	28	OS_1	\N	A000399	VSL-003	\N	On Board	2025-08-22T00:00:00.000+00:00	\N	\N	2026-05-22T00:00:00.000+00:00	\N	\N	crew17594708919422418@seafarer.com	+6-827-8536303	\N	\N	\N	\N	\N	\N	\N	185	68	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000402	Marcin	\N	Polish	Chemical Tanker	\N	2025-11-13 13:05:55.790769	2025-11-13 13:05:55.790769	\N	Kowalski	1970-04-25	55	OS_2	\N	A000401	VSL-003	\N	On Board	2025-09-29T00:00:00.000+00:00	\N	\N	2026-03-29T00:00:00.000+00:00	\N	\N	crew17594708920451798@seafarer.com	+88-440-7868755	\N	\N	\N	\N	\N	\N	\N	171	79	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000422	Jose	\N	Filipino	Bulk Carrier	\N	2025-11-13 13:06:11.015098	2025-11-13 13:06:11.015098	\N	Santos	1989-07-11	36	4th Engineer	\N	A000421	VSL-005	\N	On Board	2025-05-15T00:00:00.000+00:00	\N	\N	2026-02-15T00:00:00.000+00:00	\N	\N	crew17594708930821627@seafarer.com	+36-324-6466244	\N	\N	\N	\N	\N	\N	\N	172	77	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000424	Zhang	\N	Chinese	Chemical Tanker	\N	2025-11-13 13:06:11.263433	2025-11-13 13:06:11.263433	\N	Huang	1978-05-12	47	4th Engineer	\N	A000423	VSL-003	\N	On Board	2025-09-28T00:00:00.000+00:00	\N	\N	2026-04-28T00:00:00.000+00:00	\N	\N	crew17594708931882192@seafarer.com	+81-922-5073884	\N	\N	\N	\N	\N	\N	\N	165	82	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000434	Kumar	\N	Indian	Oil Tanker	\N	2025-11-13 13:06:18.1778	2025-11-13 13:06:18.1778	\N	Patel	1974-08-01	51	Fitter_1	\N	A000433	VSL-005	\N	On Board	2025-07-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708937109325@seafarer.com	+28-468-1667139	\N	\N	\N	\N	\N	\N	\N	171	69	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000436	Lars	\N	Norwegian	Container Ship	\N	2025-11-13 13:06:18.422234	2025-11-13 13:06:18.422234	\N	Andersen	1983-12-08	42	Fitter_1	\N	A000435	VSL-003	\N	On Board	2025-06-12T00:00:00.000+00:00	\N	\N	2026-02-12T00:00:00.000+00:00	\N	\N	crew17594708938147490@seafarer.com	+67-201-3842130	\N	\N	\N	\N	\N	\N	\N	166	76	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000446	Sergiy	\N	Ukrainian	Container Ship	\N	2025-11-13 13:06:25.417695	2025-11-13 13:06:25.417695	\N	Petrenko	1993-04-26	32	Oiler_1	\N	A000445	VSL-005	\N	On Board	2025-04-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708943329322@seafarer.com	+77-540-9475341	\N	\N	\N	\N	\N	\N	\N	182	67	\N	\N	\N	Good	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000448	Pedro	\N	Filipino	Chemical Tanker	\N	2025-11-13 13:06:25.653356	2025-11-13 13:06:25.653356	\N	Garcia	1970-01-17	55	Oiler_2	\N	A000447	VSL-005	\N	On Board	2025-05-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708944352678@seafarer.com	+98-523-8553589	\N	\N	\N	\N	\N	\N	\N	176	72	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000450	Constantin	\N	Romanian	Chemical Tanker	\N	2025-11-13 13:06:25.887288	2025-11-13 13:06:25.887288	\N	Dumitrescu	1982-03-05	43	Oiler_3	\N	A000449	VSL-005	\N	On Board	2025-08-01T00:00:00.000+00:00	\N	\N	2026-04-01T00:00:00.000+00:00	\N	\N	crew17594708945385314@seafarer.com	+45-339-9144253	\N	\N	\N	\N	\N	\N	\N	170	83	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000452	Zhang	\N	Chinese	Chemical Tanker	\N	2025-11-13 13:06:26.121523	2025-11-13 13:06:26.121523	\N	Wu	1991-08-11	34	Oiler_2	\N	A000451	VSL-003	\N	On Board	2025-08-16T00:00:00.000+00:00	\N	\N	2026-05-16T00:00:00.000+00:00	\N	\N	crew17594708946405753@seafarer.com	+37-778-3488903	\N	\N	\N	\N	\N	\N	\N	179	77	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000454	Jose	\N	Filipino	Oil Tanker	\N	2025-11-13 13:06:26.363789	2025-11-13 13:06:26.363789	\N	Santos	1978-01-19	47	Oiler_1	\N	A000453	VSL-003	\N	On Board	2025-04-15T00:00:00.000+00:00	\N	\N	2025-11-15T00:00:00.000+00:00	\N	\N	crew17594708947438049@seafarer.com	+76-462-4465815	\N	\N	\N	\N	\N	\N	\N	166	80	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000456	Li	\N	Chinese	Container Ship	\N	2025-11-13 13:06:26.59813	2025-11-13 13:06:26.59813	\N	Huang	1989-06-12	36	Oiler_3	\N	A000455	VSL-003	\N	On Board	2025-07-01T00:00:00.000+00:00	\N	\N	2026-01-01T00:00:00.000+00:00	\N	\N	crew17594708948471485@seafarer.com	+51-436-6065247	\N	\N	\N	\N	\N	\N	\N	170	68	\N	\N	\N	Excellent	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000476	Rizky	\N	Indonesian	Oil Tanker	\N	2025-11-13 13:06:41.924783	2025-11-13 13:06:41.924783	\N	Setiawan	1988-05-23	37	Chief Cook	\N	A000475	VSL-005	\N	On Board	2025-06-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708958889897@seafarer.com	+95-690-2758487	\N	\N	\N	\N	\N	\N	\N	179	73	\N	\N	\N	Fair	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000478	Tomasz	\N	Polish	Container Ship	\N	2025-11-13 13:06:42.160591	2025-11-13 13:06:42.160591	\N	Nowak	1985-05-06	40	Chief Cook	\N	A000477	VSL-003	\N	On Board	2025-06-04T00:00:00.000+00:00	\N	\N	2026-03-04T00:00:00.000+00:00	\N	\N	crew17594708959919783@seafarer.com	+84-203-8816436	\N	\N	\N	\N	\N	\N	\N	175	78	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000488	Amit	\N	Indian	Oil Tanker	\N	2025-11-13 13:06:49.091359	2025-11-13 13:06:49.091359	\N	Patel	1982-05-21	43	Messman	\N	A000487	VSL-005	\N	On Board	2025-03-15T00:00:00.000+00:00	\N	\N	2025-12-15T00:00:00.000+00:00	\N	\N	crew17594708965082047@seafarer.com	+33-705-2996388	\N	\N	\N	\N	\N	\N	\N	184	67	\N	\N	\N	Fair	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000490	Wei	\N	Chinese	Bulk Carrier	\N	2025-11-13 13:06:49.327148	2025-11-13 13:06:49.327148	\N	Huang	1980-07-06	45	Messman	\N	A000489	VSL-003	\N	On Board	2025-09-10T00:00:00.000+00:00	\N	\N	2026-06-10T00:00:00.000+00:00	\N	\N	crew17594708966113304@seafarer.com	+88-690-1854666	\N	\N	\N	\N	\N	\N	\N	173	85	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000500	Per	\N	Norwegian	Container Ship	\N	2025-11-13 13:06:56.254016	2025-11-13 13:06:56.254016	\N	Andersen	1978-09-11	47	Electrical Officer	\N	A000499	VSL-005	\N	On Board	2025-04-01T00:00:00.000+00:00	\N	\N	2026-02-01T00:00:00.000+00:00	\N	\N	crew17594708971248633@seafarer.com	+34-472-7673093	\N	\N	\N	\N	\N	\N	\N	177	73	\N	\N	\N	Good	Married	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A000502	Oleksandr	\N	Ukrainian	Oil Tanker	\N	2025-11-13 13:06:56.494913	2025-11-13 13:06:56.494913	\N	Bondarenko	1996-07-11	29	Electrical Officer	\N	A000501	VSL-003	\N	On Board	2025-09-11T00:00:00.000+00:00	\N	\N	2026-05-11T00:00:00.000+00:00	\N	\N	crew17594708972274095@seafarer.com	+20-831-9209220	\N	\N	\N	\N	\N	\N	\N	185	76	\N	\N	\N	Excellent	Single	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
TEST999	Phase4	Complete	Philippines	Container	\N	2025-11-13 14:37:31.935001	2025-11-13 14:37:31.935001	\N	Tester	\N	\N	Master	\N	A0020	MV PHASE 4	\N	Active	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A0021	Final	Test	India	Tanker	\N	2025-11-13 14:42:33.564486	2025-11-13 14:42:33.564486	\N	User	\N	\N	Chief Officer	\N	A0021	MV COMPLETE	\N	Active	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
A0022	Final	Fix	Philippines	Tanker	\N	2025-11-14 05:05:58.15768	2025-11-14 05:05:58.15768	\N	Test	\N	\N	Chief Officer	\N	A0022	MV SUCCESS	\N	Active	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: data_masters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.data_masters (id, name, description, created_at, updated_at) FROM stdin;
001	Nationality Master	Nationality reference data	2025-11-13 13:04:27.06697	2025-11-13 13:04:27.06697
014	Vessel Master	Vessel Master Data	2025-11-13 13:04:27.303215	2025-11-13 13:04:27.303215
015	Vessel Type Master	Vessel Type reference data	2025-11-13 13:04:27.537036	2025-11-13 13:04:27.537036
\.


--
-- Data for Name: drug_alcohol_test_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drug_alcohol_test_records (id, vessel_id, test_type, alcohol_drug_type, place_location, date_time_test_completed, external_test_results_date, incident_id, testing_equipment, equipment_not_applicable, test_history, frequency_months, planned_port, planned_date, planned_comments, incident_title, incident_date_time, alcohol_test_date_time, drug_test_date_time, violations, test_date_time, other_test_type, reason_for_testing, description, initiated_by, personnel_tested, comments, master_deputy_signature, attachment_file, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: fixed_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fixed_tasks (id, crew_member_id, vessel_id, rank, name, month_year, sea_hours, port_hours, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: forms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.forms (id, name, rank_group, version_no, version_date, configuration, category) FROM stdin;
1	Crew Appraisal Form	Test Senior Officers Group, Junior Deck Officers, Senior Officers - Promotion	01	01-Jan-2025	\N	appraisal
2	Promotion Review Form		00	13-Oct-2025	\N	promotion
3	New Promotion Form	Master Group	00	13-Oct-2025	{"seafarerInfoFields":["name","dob","currentRank","promotionRank","vessel"],"criteriaRows":[{"id":"a2.1","criteria":"A2.1 Higher License Criteria?","configurable":true,"visible":true},{"id":"a2.2","criteria":"A2.2 Age Criteria?","configurable":true,"visible":true},{"id":"a2.3","criteria":"A2.3 Experience & Sea Service Criteria?","configurable":true,"visible":true},{"id":"a2.3a","criteria":"A2.3a  Minimum Rank Experience (Vessel)?","configurable":true,"visible":true},{"id":"a2.3b","criteria":"A2.3b  Minimum Rank Experience (Vessel Type)?","configurable":true,"visible":true},{"id":"a2.3c","criteria":"A2.3c  Minimum Company Service in previous rank?","configurable":true,"visible":true},{"id":"a2.3d","criteria":"A2.3d  Minimum Tanker Experience?","configurable":true,"visible":true},{"id":"a2.4","criteria":"A2.4 Recommendations Criteria?","configurable":true,"visible":true},{"id":"a2.5a","criteria":"A2.5a Promotion Checklist Completed?","configurable":true,"visible":true},{"id":"a2.6","criteria":"A2.6 Other Criteria?","configurable":true,"visible":true},{"id":"a2.7","criteria":"A2.7 CES / Language Tests Criteria?","configurable":true,"visible":true},{"id":"a2.8","criteria":"A2.8 Training & Other Documents Verification?","configurable":true,"visible":true}],"trainingNeedsEnabled":true,"commentsEnabled":true,"approverOptions":["Marine Superintendent","Technical Superintendent","Crew Manager","Fleet Manager"],"vesselTypesEnabled":true,"vesselClassesEnabled":true,"executionFields":["confirmationStatus","vesselAssignment","promotionDate","promotionTiming"],"formVersion":"00","formDate":"13-Oct-2025","rankGroupName":"Master Group","savedAt":"2025-10-13T15:04:55.535Z"}	promotion
4	test		00	14-Nov-2025	\N	appraisal
5	test		00	14-Nov-2025	\N	appraisal
\.


--
-- Data for Name: id_counters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.id_counters (id, counter_type, current_value, prefix, format, updated_at) FROM stdin;
1	crew_id	27	A	0000	2025-11-14 10:01:29.784742
\.


--
-- Data for Name: master_data_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.master_data_entries (id, master_id, entry_id, nuid, name, description, "countryName", country, cid, "countryCode", nationality, "countryRefId", vtuid, "vesselType", tanker, "oilTanker", "gasTanker", "chemicalTanker", bulk, "isActive", "isDeleted", "createdBy", domain, "orderBy", fuid, "managerId", aguid, "userId", "vesselIds", vouid, address, email, phone, company, "nameOfContactPerson", duid, "shortCode", type, department, uuid, lastname, firstname, "addressLine1", "addressLine2", "addressLine3", city, state, zipcode, "loginId", "roleId", "designationId", "profilePic", "userType", "departmentId", created_at, updated_at) FROM stdin;
1	014	VSL-001	\N	MV Atlantic Pioneer	9245678	\N	\N	\N	\N	\N	\N	\N	Container Vessel	f	f	f	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:29.795188	2025-11-13 13:04:29.795188
2	014	VSL-002	\N	MV Ocean Explorer	9234567	\N	\N	\N	\N	\N	\N	\N	Bulk Carrier	f	f	f	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:30.042482	2025-11-13 13:04:30.042482
3	014	VSL-003	\N	MT Nordic Star	9156789	\N	\N	\N	\N	\N	\N	\N	Oil Tanker	t	t	f	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:30.288022	2025-11-13 13:04:30.288022
4	014	VSL-004	\N	MV Pacific Voyager	9178901	\N	\N	\N	\N	\N	\N	\N	General Cargo	f	f	f	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:30.52666	2025-11-13 13:04:30.52666
5	014	VSL-005	\N	MT Liberty Gas	9189012	\N	\N	\N	\N	\N	\N	\N	LPG Tanker	t	f	t	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:30.766348	2025-11-13 13:04:30.766348
6	014	VSL-006	\N	MV Global Trader	9201234	\N	\N	\N	\N	\N	\N	\N	Container Vessel	f	f	f	f	f	t	f	admin	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-11-13 13:04:31.006183	2025-11-13 13:04:31.006183
\.


--
-- Data for Name: nc_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.nc_reports (id, crew_member_id, vessel_id, rank, month_value, nc_reference, identified_root_cause, immediate_corrective_action, preventive_action, preventive_action_status, preventive_action_due_date, preventive_action_date_completed, office_closure_verified_by_name, office_closure_verified_by_position, office_closure_date, status, submission_status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: office_violation_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.office_violation_comments (id, vessel_id, month_value, comment, reviewer_name, reviewer_position, review_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: promotion_hierarchies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotion_hierarchies (id, group_name, rank_path, is_active, created_at, updated_at) FROM stdin;
1	Deck Officers	["Master","Chief Officer","2nd Officer","3rd Officer"]	t	2025-11-13 13:04:26.361689	2025-11-13 13:04:26.361689
2	Engine Officers	["Chief Engineer","2nd Engineer","3rd Engineer","4th Engineer"]	t	2025-11-13 13:04:26.597285	2025-11-13 13:04:26.597285
3	Deck ratings	["Bosun","AB","OS"]	t	2025-11-13 13:04:26.830959	2025-11-13 13:04:26.830959
4	Test Hierarchy	["Rank1","Rank2","Rank3"]	t	2025-11-14 08:04:25.355509	2025-11-14 08:04:25.355509
\.


--
-- Data for Name: rank_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rank_groups (id, form_id, name, ranks) FROM stdin;
1	1	Test Senior Officers Group	["Master"]
2	1	Junior Deck Officers	["2nd Officer","3rd Officer"]
3	1	Senior Officers - Promotion	["Master"]
4	3	Master Group	["Master"]
\.


--
-- Data for Name: recruitment_candidates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recruitment_candidates (id, file_no, first_name, middle_name, family_name, dob, nationality, rank_applied_for, present_rank, vessel_type, status, application_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rest_hours_crew_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rest_hours_crew_records (id, vessel_id, vessel_name, crew_member_id, rank, name, month, month_value, sign_on_off_info, recording_status_percent, activity_conflicting, total_violations, total_ncs, predicted_violations, predicted_ncs, created_at, updated_at) FROM stdin;
2	VSL-001	MV Atlantic Star	A000264	Master	John Fiddich	November 2025	2025-11	2025-10-15 to Present	0	f	2	0	0	0	2025-11-14 11:43:37.123956	2025-11-14 11:43:37.123956
\.


--
-- Data for Name: rest_hours_daily_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rest_hours_daily_records (id, crew_member_id, vessel_id, rank, name, month_year, daily_records, show_planning, opa_mode, created_at, updated_at) FROM stdin;
2	A000264	VSL-001	Master	John Fiddich	2025-11	[{"date":"2025-11-01","workHours":10,"restHours":14,"compliant":true,"isPlan":false},{"date":"2025-11-02","workHours":12,"restHours":12,"compliant":true,"isPlan":false},{"date":"2025-11-03","workHours":8,"restHours":16,"compliant":true,"isPlan":false},{"date":"2025-11-15","workHours":14,"restHours":10,"compliant":true,"correctionNote":"Hours corrected after review","isPlan":false},{"date":"2025-11-16","workHours":8,"restHours":16,"compliant":true,"isPlan":false}]	f	f	2025-11-14 11:45:10.127998	2025-11-14 11:45:10.127998
\.


--
-- Data for Name: rest_hours_vessel_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rest_hours_vessel_records (id, vessel_id, vessel_name, month, month_value, total_crew, recording_status_percent, activity_conflicting, crew_with_activity_conflicts, crew_with_activity_conflicts_details, total_violations, crew_with_violations, crew_with_violations_details, total_ncs, crew_with_ncs, crew_with_ncs_details, predicted_violations, crew_with_predicted_violations, crew_with_predicted_violations_details, predicted_ncs, crew_with_predicted_ncs, crew_with_predicted_ncs_details, vessel_review_status, vessel_review_submitted_date, office_review_status, office_review_submitted_date, created_at, updated_at) FROM stdin;
2	VSL-001	MV Atlantic Star	November 2025	2025-11	23	0	f	0	\N	8	4	\N	0	0	\N	1	0	\N	0	0	\N	Submitted	\N	Due	\N	2025-11-14 11:43:07.234042	2025-11-14 11:43:07.234042
\.


--
-- Data for Name: revisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.revisions (id, vessel_id, revision_no, flex_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rotation_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rotation_plans (id, draft_id, last_edited, vessels, crew, plan_from_date, plan_to_date, created_by, plan_status, proposed_by, proposed_date, assignments, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: seafarers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seafarers (id, first_name, middle_name, last_name, rank, nationality, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password) FROM stdin;
\.


--
-- Data for Name: variable_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.variable_tasks (id, start_date_time, finish_date_time, start_date_time_sort, finish_date_time_sort, task, status, crew_involved, remarks, period_value, vessel_id, is_draft, record_type, status_type, selected_tasks, other_task, crew_involved_details, comments) FROM stdin;
\.


--
-- Data for Name: vessel_dateline_adjustments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_dateline_adjustments (id, vessel_id, month_value, adjustments, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vessel_drafts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_drafts (id, vessel_id, revision, draft_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vessel_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_groups (id, name, description, vessel_ids, created_at, updated_at) FROM stdin;
1	Fleet 1	\N	["1","2"]	2025-09-28 09:07:46.456	2025-09-28 09:07:46.456
2	Fleet 2	\N	["3","4","5"]	2025-09-28 09:21:02.328	2025-09-28 09:21:02.328
\.


--
-- Data for Name: vessel_planning; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_planning (id, vessel_id, rank_id, rank, crew_member_id, on_board_crew_id, on_board_crew_name, on_board_crew_nationality, relief_due, sign_off_date, sign_off_port, relief_status, reliever_crew_id, reliever_crew_name, reliever_nationality, joining_date, joining_port, joining_status, contract_period_months, contract_end_range_start_months, contract_end_range_end_months, deployment_checklist_completed, applicable_docs_checked, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vessel_ranks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_ranks (id, vessel_id, revision_id, rank, rank_id, role, original_rank_id, is_role_row, officer, rating, senior_officer, deck_officer, eng_officer, petty_officer, deck_rating, engine_rating, general_rating, catering_rating, safety_officer, sso, medical_officer, navigating_officer, emt_officer, actual_manning, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vessel_revisions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_revisions (id, vessel_id, revision, revision_date, revision_data, created_at) FROM stdin;
\.


--
-- Data for Name: vessel_violation_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessel_violation_comments (id, vessel_id, month_value, comment, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vessels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vessels (id, name, vessel_group, vessel_type, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: appraisal_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appraisal_results_id_seq', 12, true);


--
-- Name: available_ranks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.available_ranks_id_seq', 20, true);


--
-- Name: drug_alcohol_test_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drug_alcohol_test_records_id_seq', 6, true);


--
-- Name: fixed_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fixed_tasks_id_seq', 1, true);


--
-- Name: forms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.forms_id_seq', 5, true);


--
-- Name: id_counters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.id_counters_id_seq', 1, true);


--
-- Name: master_data_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_data_entries_id_seq', 7, true);


--
-- Name: nc_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.nc_reports_id_seq', 1, true);


--
-- Name: office_violation_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.office_violation_comments_id_seq', 1, true);


--
-- Name: promotion_hierarchies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotion_hierarchies_id_seq', 4, true);


--
-- Name: rank_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rank_groups_id_seq', 5, true);


--
-- Name: rest_hours_crew_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rest_hours_crew_records_id_seq', 3, true);


--
-- Name: rest_hours_daily_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rest_hours_daily_records_id_seq', 4, true);


--
-- Name: rest_hours_vessel_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rest_hours_vessel_records_id_seq', 3, true);


--
-- Name: revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.revisions_id_seq', 1, false);


--
-- Name: rotation_plans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rotation_plans_id_seq', 4, true);


--
-- Name: seafarers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.seafarers_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: variable_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.variable_tasks_id_seq', 1, true);


--
-- Name: vessel_dateline_adjustments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_dateline_adjustments_id_seq', 1, true);


--
-- Name: vessel_drafts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_drafts_id_seq', 1, true);


--
-- Name: vessel_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_groups_id_seq', 4, true);


--
-- Name: vessel_planning_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_planning_id_seq', 3, true);


--
-- Name: vessel_ranks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_ranks_id_seq', 1, true);


--
-- Name: vessel_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_revisions_id_seq', 1, true);


--
-- Name: vessel_violation_comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessel_violation_comments_id_seq', 1, true);


--
-- Name: vessels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vessels_id_seq', 1, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: appraisal_results appraisal_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_results
    ADD CONSTRAINT appraisal_results_pkey PRIMARY KEY (id);


--
-- Name: available_ranks available_ranks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.available_ranks
    ADD CONSTRAINT available_ranks_pkey PRIMARY KEY (id);


--
-- Name: company_ranks company_ranks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_ranks
    ADD CONSTRAINT company_ranks_pkey PRIMARY KEY (id);


--
-- Name: crew_members crew_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_pkey PRIMARY KEY (id);


--
-- Name: data_masters data_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_masters
    ADD CONSTRAINT data_masters_pkey PRIMARY KEY (id);


--
-- Name: drug_alcohol_test_records drug_alcohol_test_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_alcohol_test_records
    ADD CONSTRAINT drug_alcohol_test_records_pkey PRIMARY KEY (id);


--
-- Name: fixed_tasks fixed_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_tasks
    ADD CONSTRAINT fixed_tasks_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: id_counters id_counters_counter_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.id_counters
    ADD CONSTRAINT id_counters_counter_type_unique UNIQUE (counter_type);


--
-- Name: id_counters id_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.id_counters
    ADD CONSTRAINT id_counters_pkey PRIMARY KEY (id);


--
-- Name: master_data_entries master_data_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_entries
    ADD CONSTRAINT master_data_entries_pkey PRIMARY KEY (id);


--
-- Name: nc_reports nc_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nc_reports
    ADD CONSTRAINT nc_reports_pkey PRIMARY KEY (id);


--
-- Name: office_violation_comments office_violation_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_violation_comments
    ADD CONSTRAINT office_violation_comments_pkey PRIMARY KEY (id);


--
-- Name: promotion_hierarchies promotion_hierarchies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_hierarchies
    ADD CONSTRAINT promotion_hierarchies_pkey PRIMARY KEY (id);


--
-- Name: rank_groups rank_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_groups
    ADD CONSTRAINT rank_groups_pkey PRIMARY KEY (id);


--
-- Name: recruitment_candidates recruitment_candidates_file_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_candidates
    ADD CONSTRAINT recruitment_candidates_file_no_unique UNIQUE (file_no);


--
-- Name: recruitment_candidates recruitment_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recruitment_candidates
    ADD CONSTRAINT recruitment_candidates_pkey PRIMARY KEY (id);


--
-- Name: rest_hours_crew_records rest_hours_crew_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_crew_records
    ADD CONSTRAINT rest_hours_crew_records_pkey PRIMARY KEY (id);


--
-- Name: rest_hours_daily_records rest_hours_daily_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_daily_records
    ADD CONSTRAINT rest_hours_daily_records_pkey PRIMARY KEY (id);


--
-- Name: rest_hours_vessel_records rest_hours_vessel_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rest_hours_vessel_records
    ADD CONSTRAINT rest_hours_vessel_records_pkey PRIMARY KEY (id);


--
-- Name: revisions revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_pkey PRIMARY KEY (id);


--
-- Name: rotation_plans rotation_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rotation_plans
    ADD CONSTRAINT rotation_plans_pkey PRIMARY KEY (id);


--
-- Name: seafarers seafarers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seafarers
    ADD CONSTRAINT seafarers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: variable_tasks variable_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variable_tasks
    ADD CONSTRAINT variable_tasks_pkey PRIMARY KEY (id);


--
-- Name: vessel_dateline_adjustments vessel_dateline_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_dateline_adjustments
    ADD CONSTRAINT vessel_dateline_adjustments_pkey PRIMARY KEY (id);


--
-- Name: vessel_drafts vessel_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_drafts
    ADD CONSTRAINT vessel_drafts_pkey PRIMARY KEY (id);


--
-- Name: vessel_groups vessel_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_groups
    ADD CONSTRAINT vessel_groups_pkey PRIMARY KEY (id);


--
-- Name: vessel_planning vessel_planning_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_planning
    ADD CONSTRAINT vessel_planning_pkey PRIMARY KEY (id);


--
-- Name: vessel_ranks vessel_ranks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_ranks
    ADD CONSTRAINT vessel_ranks_pkey PRIMARY KEY (id);


--
-- Name: vessel_revisions vessel_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_revisions
    ADD CONSTRAINT vessel_revisions_pkey PRIMARY KEY (id);


--
-- Name: vessel_violation_comments vessel_violation_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_violation_comments
    ADD CONSTRAINT vessel_violation_comments_pkey PRIMARY KEY (id);


--
-- Name: vessels vessels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessels
    ADD CONSTRAINT vessels_pkey PRIMARY KEY (id);


--
-- Name: appraisal_results appraisal_results_crew_member_id_crew_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_results
    ADD CONSTRAINT appraisal_results_crew_member_id_crew_members_id_fk FOREIGN KEY (crew_member_id) REFERENCES public.crew_members(id);


--
-- Name: appraisal_results appraisal_results_form_id_forms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appraisal_results
    ADD CONSTRAINT appraisal_results_form_id_forms_id_fk FOREIGN KEY (form_id) REFERENCES public.forms(id);


--
-- Name: master_data_entries master_data_entries_master_id_data_masters_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_entries
    ADD CONSTRAINT master_data_entries_master_id_data_masters_id_fk FOREIGN KEY (master_id) REFERENCES public.data_masters(id);


--
-- Name: rank_groups rank_groups_form_id_forms_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rank_groups
    ADD CONSTRAINT rank_groups_form_id_forms_id_fk FOREIGN KEY (form_id) REFERENCES public.forms(id);


--
-- Name: revisions revisions_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revisions
    ADD CONSTRAINT revisions_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id);


--
-- Name: vessel_ranks vessel_ranks_revision_id_revisions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_ranks
    ADD CONSTRAINT vessel_ranks_revision_id_revisions_id_fk FOREIGN KEY (revision_id) REFERENCES public.revisions(id);


--
-- Name: vessel_ranks vessel_ranks_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vessel_ranks
    ADD CONSTRAINT vessel_ranks_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id);


--
-- PostgreSQL database dump complete
--

