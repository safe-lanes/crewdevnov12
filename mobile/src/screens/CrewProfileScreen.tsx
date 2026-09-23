import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { crewInformationApi, CrewInformationMasters } from "../api/crewInformationApi";
import { Button, Field, MultiSelectField, palette, SelectField, StateView, styles } from "../components/CrewUI";
import { useCrewInformationQuery, useCrewInformationMastersQuery, useInvalidateCrewInformation } from "../hooks/useCrewInformationQuery";

function validationErrors(error: any): Record<string, string> {
  const fields = error?.details?.fieldErrors;
  if (!fields || typeof fields !== "object") return {};
  return Object.fromEntries(Object.entries(fields).flatMap(([key, messages]) => {
    const message = Array.isArray(messages) ? messages[0] : messages;
    return typeof message === "string" ? [[key, message]] : [];
  }));
}

function keyboardFor(field: string): any {
  if (field === "email") return "email-address";
  if (/mobile|telephone|landline/i.test(field)) return "phone-pad";
  if (/height|weight|children/i.test(field)) return "numeric";
  return "default";
}

const groups = [
  ["Particulars", "particulars", ["firstName", "middleName", "familyName", "gender", "dob", "nationality"]],
  ["Personal details", "personal", ["heightCm", "weightKg", "placeOfBirthCity", "placeOfBirthCountry", "nativeLanguageUuid", "foreignLanguages", "englishProficiency"]],
  ["Address & contact", "contact", ["countryOfResidence", "nearestAirport", "addressLine1", "addressLine2", "contactLandline", "mobile", "email"]],
  ["Family", "family", ["maritalStatus", "numDependentChildren", "fatherName", "motherName", "spouseFirstName", "spouseMiddleName", "spouseFamilyName", "spouseDob"]],
  ["Next of kin", "next-of-kin", ["firstName", "middleName", "familyName", "telephone", "email", "address", "relationship"]],
  ["Vessel types", "vessel-types", ["vesselTypeUuids"]],
] as const;

export default function CrewProfileScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>();
  const infoQuery = useCrewInformationQuery(); const mastersQuery = useCrewInformationMastersQuery();
  const info = infoQuery.data; const masters = mastersQuery.data;
  const loading = infoQuery.isLoading || mastersQuery.isLoading;
  const error = infoQuery.error ? (infoQuery.error as Error).message : mastersQuery.error ? (mastersQuery.error as Error).message : "";
  const load = () => { infoQuery.refetch(); mastersQuery.refetch(); };
  const active = route.params?.section;
  const reviewStatusFor = (key: string): string | undefined => key === "family" ? info?.sections?.family?.info?.reviewStatus : key === "next-of-kin" ? info?.sections?.family?.nextOfKin?.reviewStatus : info?.sections?.[key]?.reviewStatus;
  if (active) return <StateView loading={loading} error={error} retry={load}>{info && masters ? <ProfileEditor section={active} info={info} masters={masters} writable={Boolean(info.permissions?.writableSingletons?.includes(active)) && reviewStatusFor(active) !== "pending"} pending={reviewStatusFor(active) === "pending"} onDone={() => navigation.goBack()} /> : null}</StateView>;
  const isPresent = (key: string) => key === "family" ? Boolean(info?.sections?.family?.info) : key === "next-of-kin" ? Boolean(info?.sections?.family?.nextOfKin) : key === "vessel-types" ? Boolean(info?.sections?.vesselTypes?.length) : Boolean(info?.sections?.[key]);
  const completed = groups.filter(([, key]) => isPresent(key)).length + (info?.sections?.family?.children?.length ? 1 : 0);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.title}>My Profile</Text><StateView loading={loading} error={error} retry={load}><View style={styles.card}><Text style={styles.cardTitle}>Profile progress</Text><Text style={styles.cardMeta}>{completed} of 7 sections have information</Text><View style={{ height: 7, borderRadius: 4, backgroundColor: palette.line, marginTop: 12 }}><View style={{ height: 7, borderRadius: 4, backgroundColor: palette.teal, width: `${(completed / 7) * 100}%` }} /></View></View><RecentSubmissions submissions={info?.recentSubmissions} />{groups.map(([label, key]) => <View key={key} style={styles.card}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{label}</Text><Text style={reviewStatusFor(key) === "pending" ? { color: palette.amber, fontWeight: "800", marginTop: 4 } : styles.cardMeta}>{reviewStatusFor(key) === "pending" ? "Awaiting crewing team review" : isPresent(key) ? "Information added" : "Needs attention"}</Text></View><Button title="Open" secondary onPress={() => navigation.push("CrewProfile", { section: key })} /></View></View>)}<View style={styles.card}><View style={styles.row}><View><Text style={styles.cardTitle}>Children</Text><Text style={styles.cardMeta}>{info?.sections?.family?.children?.length ? `${info.sections.family.children.length} records` : "No records"}</Text></View><Button title="Open" secondary onPress={() => navigation.navigate("CrewCollection", { collection: "children" })} /></View></View></StateView></ScrollView>;
}

const SECTION_LABELS: Record<string, string> = { particulars: "Particulars", personal: "Personal details", contact: "Address & contact", family: "Family", "next-of-kin": "Next of kin", "vessel-types": "Vessel types", children: "Children", documents: "Documents", visas: "Visas", education: "Education", licenses: "Licenses", training: "Training", "sea-service": "Sea service" };
const ACTION_LABELS: Record<string, string> = { create: "New entry", update: "Update", delete: "Deletion" };

/** Requirement 1, crew-facing visibility: what happened to entries this crew member submitted, including why one was turned back. */
function RecentSubmissions({ submissions }: { submissions?: any[] }) {
  const notable = (submissions || []).filter((s) => s.status !== "approved" || s.action !== "update");
  if (!notable.length) return null;
  return <View style={styles.card}>
    <Text style={styles.cardTitle}>Recent submissions</Text>
    {notable.slice(0, 8).map((item) => {
      const color = item.status === "rejected" ? palette.red : item.status === "pending" ? palette.amber : palette.teal;
      const label = item.status === "rejected" ? "Not approved" : item.status === "pending" ? "Awaiting review" : "Published";
      return <View key={item.pendingUuid} style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 }}>
        <Text style={styles.cardMeta}>{ACTION_LABELS[item.action] || item.action} · {SECTION_LABELS[item.section] || item.section}</Text>
        <Text style={{ color, fontWeight: "800", marginTop: 2 }}>{label}</Text>
        {item.status === "rejected" && item.rejectionReason ? <Text style={styles.cardMeta}>{item.rejectionReason}</Text> : null}
      </View>;
    })}
  </View>;
}

function ProfileEditor({ section, info, masters, writable, pending, onDone }: { section: string; info: any; masters: CrewInformationMasters; writable: boolean; pending?: boolean; onDone: () => void }) {
  const navigation = useNavigation<any>(); const invalidate = useInvalidateCrewInformation(); const group = groups.find(g => g[1] === section); const [form, setForm] = useState<any>({}); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({}); const refs = React.useRef<Record<string, any>>({}); const actionLock = React.useRef(false); const completionTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseline = React.useRef("{}"); useEffect(() => { const source = section === "next-of-kin" ? info?.sections?.family?.nextOfKin : section === "family" ? info?.sections?.family?.info : info?.sections?.[section]; const raw = section === "vessel-types" ? { vesselTypeUuids: (Array.isArray(source) ? source : []).map((row: any) => row.vesselTypeUuid).filter(Boolean).join(", ") } : source; setForm(raw || {}); baseline.current = JSON.stringify(raw || {}); }, [info, section]);
  if (!group) return null;
  const dirty = JSON.stringify(form) !== baseline.current;
  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current); }, []);
  useEffect(() => { const unsub = navigation.addListener("beforeRemove", (event: any) => { if (!dirty || saving) return; event.preventDefault(); Alert.alert("Discard changes?", "Your entered data has not been saved.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(event.data.action) }]); }); return unsub; }, [dirty, saving, navigation]);
  const save = async () => { if (!writable || actionLock.current || saving || saved) return; actionLock.current = true; setSaving(true); setSaved(false); setErrors({}); try { const clean: Record<string, any> = Object.fromEntries(group[2].map((key) => {
    const value = form[key];
    if (value !== undefined && value !== "") return [key, value];
    const cannotClear = section === "particulars" && ["firstName", "familyName", "nationality"].includes(key);
    return cannotClear ? [key, undefined] : [key, null];
  }).filter(([, value]) => value !== undefined)); if (section === "particulars" && form.nationalityUuid) clean.nationalityUuid = form.nationalityUuid; if (section === "personal" && form.placeOfBirthCountryUuid) clean.placeOfBirthCountryUuid = form.placeOfBirthCountryUuid; if (section === "contact" && form.countryOfResidenceUuid) clean.countryOfResidenceUuid = form.countryOfResidenceUuid; const payload = section === "vessel-types" ? { vesselTypeUuids: String(form.vesselTypeUuids || "").split(",").map((v: string) => v.trim()).filter(Boolean) } : clean; await crewInformationApi.updateSection(section, payload); invalidate(); baseline.current = JSON.stringify(form); setSaved(true); completionTimer.current = setTimeout(() => { completionTimer.current = null; onDone(); }, 700); } catch (e: any) { actionLock.current = false; const nextErrors = validationErrors(e); setErrors(nextErrors); const first = Object.keys(nextErrors)[0]; if (first) requestAnimationFrame(() => refs.current[first]?.focus?.()); Alert.alert("Could not save", Object.keys(nextErrors).length ? "Check the highlighted fields and try again." : e.message); } finally { setSaving(false); } };
  const display = section === "vessel-types" ? (Array.isArray(form.vesselTypeUuids) ? form.vesselTypeUuids.join(", ") : form.vesselTypeUuids) : undefined;
  if (!writable) return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.title}>{group[0]}</Text><Text style={[styles.subtitle, pending && { color: palette.amber, fontWeight: "800" }]}>{pending ? "Awaiting crewing team review" : "Read only"}</Text>{group[2].map((field) => <View key={field} style={styles.card}><Text style={styles.label}>{field.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase())}</Text><Text style={styles.cardMeta}>{String(form[field] ?? "—")}</Text></View>)}<Button title="Back" secondary onPress={onDone} /></ScrollView>;
  const change = (field: string, value: any) => { setErrors((current) => ({ ...current, [field]: "" })); setForm((current: any) => ({ ...current, [field]: value })); };
  const renderField = (field: string) => {
    if (field === "vesselTypeUuids") return <MultiSelectField key={field} label="Vessel types applied for" values={String(display || "").split(",").map((value) => value.trim()).filter(Boolean)} options={masters.vesselTypes || []} onChange={(values) => change(field, values.join(", "))} />;
    if (field === "nationality") return <SelectField key={field} label="Nationality" value={String(form.nationalityUuid || "")} options={masters.nationalities || []} error={errors.nationalityUuid || errors.nationality} onChange={(value) => { const label = (masters.nationalities || []).find((option) => option.value === value)?.label; change("nationalityUuid", value); if (label) change("nationality", label); }} />;
    if (field === "placeOfBirthCountry") return <SelectField key={field} label="Place of birth country" value={String(form.placeOfBirthCountryUuid || "")} options={masters.countries || []} error={errors.placeOfBirthCountryUuid || errors.placeOfBirthCountry} onChange={(value) => { change("placeOfBirthCountryUuid", value); change("placeOfBirthCountry", (masters.countries || []).find((option) => option.value === value)?.label || ""); }} />;
    if (field === "countryOfResidence") return <SelectField key={field} label="Country of residence" value={String(form.countryOfResidenceUuid || "")} options={masters.countries || []} error={errors.countryOfResidenceUuid || errors.countryOfResidence} onChange={(value) => { change("countryOfResidenceUuid", value); change("countryOfResidence", (masters.countries || []).find((option) => option.value === value)?.label || ""); }} />;
    if (field === "nativeLanguageUuid") return <SelectField key={field} label="Native language" value={String(form[field] || "")} options={masters.languages || []} error={errors[field]} onChange={(value) => change(field, value)} />;
    return <Field key={field} inputRef={(node: any) => { refs.current[field] = node; }} error={errors[field]} keyboardType={keyboardFor(field)} multiline={field === "address" || field === "foreignLanguages"} label={field.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase())} value={String(form[field] ?? "")} onChangeText={(value) => change(field, value)} />;
  };
  const exit = () => { if (completionTimer.current) { clearTimeout(completionTimer.current); completionTimer.current = null; } onDone(); };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{group[0]}</Text>{group[2].map(renderField)}{saved && <Text accessibilityLiveRegion="polite" style={{ color: palette.teal, fontWeight: "800", marginTop: 12 }}>Saved</Text>}<Button testID="profile-save-button" title={saving ? "Saving..." : saved ? "Saved" : "Save changes"} onPress={save} disabled={saving || saved} /><Button testID="profile-back-button" title={saved ? "Continue" : "Cancel"} secondary onPress={exit} /></ScrollView>;
}