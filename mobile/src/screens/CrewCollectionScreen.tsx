import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { AttachmentRules, crewInformationApi, CrewInformationMasters } from "../api/crewInformationApi";
import CrewAttachments from "../components/CrewAttachments";
import { Button, Field, palette, SelectField, StateView, styles } from "../components/CrewUI";
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
  if (/mobile|telephone/i.test(field)) return "phone-pad";
  if (/sortOrder|periodMonths|yearBuilt|deadweight/i.test(field)) return "numeric";
  return "default";
}

const documentsTabs = ["documents", "visas"];
const qualificationTabs = ["education", "training", "licenses"];
const medicalTabs = ["medicals", "doctorVisits"];
const briefingTabs = ["briefings", "debriefings"];
const config: Record<string, { title: string; description: string; fields: string[]; readonly?: boolean; tabs?: string[] }> = {
  documents: { title: "Documents & Visas", description: "Travel documents and entry permissions.", fields: ["documentId", "documentName", "number", "issued", "expiry", "issuingAuthority", "issuingCountryUuid", "sortOrder"], tabs: documentsTabs },
  visas: { title: "Documents & Visas", description: "Keep permission to travel visible and current.", fields: ["countryUuid", "country", "serialNo", "issued", "expiry", "visaType", "sortOrder"], tabs: documentsTabs },
  education: { title: "Training & Licenses", description: "Your completed education and qualifications.", fields: ["dateOfCompletion", "institution", "subjectsField", "qualifications", "sortOrder"], tabs: qualificationTabs },
  licenses: { title: "Training & Licenses", description: "Certificates and professional requirements.", fields: ["licenseId", "certificateDocument", "abbr", "requirement", "certificateNo", "issuingAuthority", "issuingCountryUuid", "issued", "expiry", "sortOrder"], tabs: qualificationTabs },
  training: { title: "Training & Licenses", description: "Courses and professional certificates that keep you ready for sea.", fields: ["courseId", "trainingCourse", "abbr", "requirement", "certificateNo", "issuingAuthority", "issuingCountryUuid", "issued", "expiry", "sortOrder"], tabs: qualificationTabs },
  "sea-service": { title: "Sea Service", description: "External service records you have supplied.", fields: ["vesselName", "vesselUuid", "vesselTypeUuid", "imoNumber", "yearBuilt", "deadweight", "engineTypePower", "ownerOperator", "rank", "fromDate", "toDate", "periodMonths", "experienceCategories", "signOffReason", "sortOrder"] },
  children: { title: "Children", description: "Family details held on your crew profile.", fields: ["firstName", "middleName", "familyName", "dob", "gender", "sortOrder"] },
  medicals: { title: "Medical", description: "Medical examinations provided by your crew team.", fields: ["vesselName", "examinationDate", "bp", "weight", "anyMedicationPrescribed", "clinicHospital", "fitForDuty", "expiryDate"], readonly: true, tabs: medicalTabs },
  doctorVisits: { title: "Medical", description: "Doctor visits recorded by your crew team.", fields: ["vessel", "port", "visitDate", "doctorName", "clinicHospital", "reason", "doctorComments", "diagnosis", "treatment", "followUpDate"], readonly: true, tabs: medicalTabs },
  briefings: { title: "Briefings & Debriefings", description: "Operational briefings assigned to you.", fields: ["vesselName", "joiningRank", "dateSignOn"], readonly: true, tabs: briefingTabs },
  debriefings: { title: "Briefings & Debriefings", description: "Debriefings recorded after service.", fields: ["vesselName", "rankServed", "dateSignOn", "dateSignedOff", "reasonForSignOff"], readonly: true, tabs: briefingTabs },
};

const idOf = (row: any) => row?.recordUuid || row?.childUuid || row?.docUuid || row?.visaUuid || row?.eduUuid || row?.licUuid || row?.trainUuid || row?.seaUuid || row?.medUuid || row?.visitUuid || row?.briefingUuid || row?.debriefingUuid || row?.uuid;
export default function CrewCollectionScreen() {
  const route = useRoute<any>(); const navigation = useNavigation<any>(); const collection = route.params.collection as string; const c = config[collection];
  const infoQuery = useCrewInformationQuery(); const mastersQuery = useCrewInformationMastersQuery();
  const info = infoQuery.data; const masters = mastersQuery.data;
  const attachmentRules = info?.permissions?.attachmentRules;
  const canWrite = Boolean(info?.permissions?.writableCollections?.includes(collection));
  const [rows, setRows] = useState<any[]>([]); const [rowsLoading, setRowsLoading] = useState(true); const [rowsError, setRowsError] = useState(""); const [editing, setEditing] = useState<any | null>(null);
  // Depends on `info` (the cached crew-information aggregate) being loaded
  // first — readonly collections and "children" read straight out of its
  // sections; the other writable collections still need their own list
  // call, since crewInformationApi.get() intentionally doesn't include them.
  const loadRows = useCallback(async () => {
    if (!info) return;
    setRowsLoading(true); setRowsError("");
    try {
      const familyRows = info.sections?.family?.children;
      setRows(
        config[collection].readonly
          ? (info.sections?.[collection] || [])
          : collection === "children"
            ? (familyRows || await crewInformationApi.list(collection))
            : await crewInformationApi.list(collection),
      );
    } catch (e: any) {
      setRowsError(e.message);
    } finally {
      setRowsLoading(false);
    }
  }, [info, collection]);
  useFocusEffect(useCallback(() => { loadRows(); }, [loadRows]));
  const loading = infoQuery.isLoading || mastersQuery.isLoading || rowsLoading;
  const error = infoQuery.error ? (infoQuery.error as Error).message : mastersQuery.error ? (mastersQuery.error as Error).message : rowsError;
  const load = () => { infoQuery.refetch(); mastersQuery.refetch(); loadRows(); };
  if (!c) return null;
  if (editing !== null && masters) return <RecordEditor collection={collection} config={c} masters={masters} attachmentRules={attachmentRules} forceReadOnly={!canWrite} record={editing === "new" ? {} : editing} onDone={() => { setEditing(null); load(); }} />;
  const readonly = Boolean(c.readonly);
  const tabLabel = (tab: string) => ({ documents: "Documents", visas: "Visas", education: "Education", training: "Training", licenses: "Licenses", briefings: "Briefings", debriefings: "Debriefings", medicals: "Medicals", doctorVisits: "Doctor visits" } as Record<string, string>)[tab] || tab;
  const showList = !loading && !error;
  return <FlatList
    style={styles.screen}
    contentContainerStyle={styles.content}
    data={showList ? rows : []}
    keyExtractor={idOf}
    ListHeaderComponent={<>
      <Text style={styles.title}>{c.title}</Text>
      {c.tabs && <View style={{ flexDirection: "row", gap: 6, marginTop: 16 }}>{c.tabs.map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === collection }} accessibilityLabel={`View ${tabLabel(tab)}`} onPress={() => navigation.setParams({ collection: tab })} style={{ flex: 1, minHeight: 48, paddingHorizontal: 5, paddingVertical: 12, borderRadius: 10, backgroundColor: tab === collection ? palette.navy : "#FFF", borderWidth: 1, borderColor: palette.line, justifyContent: "center" }}><Text numberOfLines={1} adjustsFontSizeToFit style={{ textAlign: "center", color: tab === collection ? "#FFF" : palette.navy, fontWeight: "800", fontSize: 13 }}>{tabLabel(tab)}</Text></Pressable>)}</View>}
      {!showList ? <StateView loading={loading} error={error} retry={load} /> : null}
    </>}
    ListEmptyComponent={showList ? <StateView empty={`No ${tabLabel(collection).toLowerCase()} recorded`} /> : null}
    renderItem={({ item: row }) => { const rowReadOnly = Boolean(row.readOnly || !canWrite); return <Pressable accessibilityRole="button" accessibilityLabel={`View ${tabLabel(collection)} record`} testID={`crew-record-${idOf(row)}`} onPress={() => setEditing({ ...row, readOnly: rowReadOnly })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.documentName || row.trainingCourse || row.certificateDocument || row.institution || row.vesselName || row.courseId || row.licenseId || row.country || "Record"}</Text>{row.expiry || row.expiryDate || row.rank || row.joiningRank || row.rankServed || row.qualifications ? <Text style={styles.cardMeta}>{row.expiry || row.expiryDate ? `Expires ${row.expiry || row.expiryDate}` : row.rank || row.joiningRank || row.rankServed || row.qualifications}</Text> : null}</View><Text style={{ color: rowReadOnly ? palette.muted : palette.teal, fontWeight: "800" }}>{rowReadOnly ? "View" : "Edit"}</Text></View></Pressable>; }}
    ListFooterComponent={!readonly && canWrite ? <Button title={`Add ${tabLabel(collection).replace(/s$/, "")}`} onPress={() => setEditing("new")} /> : null}
  />;
}
function RecordEditor({ collection, config: c, record, masters, attachmentRules, forceReadOnly, onDone }: { collection: string; config: any; record: any; masters: CrewInformationMasters; attachmentRules?: AttachmentRules; forceReadOnly: boolean; onDone: () => void }) {
  const navigation = useNavigation<any>(); const invalidate = useInvalidateCrewInformation(); const [form, setForm] = useState(() => Object.fromEntries(c.fields.map((field: string) => [field, record[field] ?? ""]))); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [errors, setErrors] = useState<Record<string, string>>({}); const refs = React.useRef<Record<string, any>>({}); const actionLock = React.useRef(false); const isNew = !idOf(record); const readOnly = Boolean(record.readOnly || forceReadOnly);
  const dirty = JSON.stringify(form) !== JSON.stringify(Object.fromEntries(c.fields.map((field: string) => [field, record[field] ?? ""])));
  useEffect(() => { const unsub = navigation.addListener("beforeRemove", (event: any) => { if (!dirty || saving) return; event.preventDefault(); Alert.alert("Discard changes?", "Your entered data has not been saved.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(event.data.action) }]); }); return unsub; }, [dirty, saving, navigation]);
  const save = async () => { if (actionLock.current || saving || saved || (!isNew && readOnly)) return; actionLock.current = true; const payload = Object.fromEntries(c.fields.flatMap((field: string) => {
    const value = form[field];
    if (value === undefined || value === "") return isNew ? [] : [[field, null]];
    if (field === "sortOrder") return [[field, Number(value)]];
    if (field === "experienceCategories") return [[field, Array.isArray(value) ? value : String(value).split(",").map(item => item.trim()).filter(Boolean)]];
    return [[field, value]];
  })); setSaving(true); setSaved(false); setErrors({}); try { if (isNew) await crewInformationApi.create(collection, payload); else await crewInformationApi.update(collection, idOf(record), payload); invalidate(); setSaved(true); setTimeout(onDone, 700); } catch (e: any) { actionLock.current = false; const nextErrors = validationErrors(e); setErrors(nextErrors); const first = Object.keys(nextErrors)[0]; if (first) requestAnimationFrame(() => refs.current[first]?.focus?.()); Alert.alert("Could not save", Object.keys(nextErrors).length ? "Some fields need attention. Check the highlighted values and try again." : e.message); } finally { setSaving(false); } };
  const remove = () => { if (actionLock.current || saving || readOnly) return; Alert.alert("Delete record?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { if (actionLock.current) return; actionLock.current = true; setSaving(true); try { await crewInformationApi.remove(collection, idOf(record)); invalidate(); onDone(); } catch (e: any) { actionLock.current = false; Alert.alert("Could not delete", e.message); } finally { setSaving(false); } } }]); };
  const attachmentCollection = collection === "doctorVisits" ? "doctor-visits" : collection;
  const parentUuid = idOf(record);
  const canReadFiles = Boolean(parentUuid && attachmentRules?.readableCollections.includes(attachmentCollection));
  const canWriteFiles = Boolean(canReadFiles && !readOnly && attachmentRules?.writableCollections.includes(attachmentCollection));
  if (readOnly) { const detailFields = Array.from(new Set([...c.fields, ...Object.keys(record).filter((key) => !["readOnly", "recordUuid", "id"].includes(key) && !/uuid$/i.test(key))])).filter((field) => record[field] !== undefined && record[field] !== null && record[field] !== "").slice(0, 24); return <ScrollView style={styles.screen} contentContainerStyle={styles.content}><Text style={styles.title}>Record details</Text><Text style={styles.subtitle}>Read only</Text>{detailFields.map((field: string) => <View key={field} style={styles.card}><Text style={styles.label}>{field.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase())}</Text><Text style={styles.cardMeta}>{String(record[field])}</Text></View>)}{canReadFiles ? <CrewAttachments collection={attachmentCollection} parentUuid={parentUuid} writable={false} maxBytes={attachmentRules?.maxBytes} /> : null}<Button title="Back" secondary onPress={onDone} /></ScrollView>; }
  const change = (field: string, value: any) => { setSaved(false); setErrors((current) => ({ ...current, [field]: "" })); setForm((current: any) => ({ ...current, [field]: value })); };
  const optionsFor = (field: string) => field === "vesselUuid" ? (masters.vessels || []) : field === "vesselTypeUuid" ? (masters.vesselTypes || []) : ["countryUuid", "issuingCountryUuid"].includes(field) ? (masters.countries || []) : null;
  const cancel = () => dirty ? Alert.alert("Discard changes?", "Your entered data has not been saved.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: onDone }]) : onDone();
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.title}>{isNew ? "Add record" : "Edit record"}</Text>{c.fields.map((field: string) => { const options = optionsFor(field); return options ? <SelectField key={field} label={field === "vesselUuid" ? "Vessel" : field === "vesselTypeUuid" ? "Vessel type" : "Issuing country"} value={String(form[field] || "")} options={options} error={errors[field]} onChange={(value) => change(field, value)} /> : <Field key={field} inputRef={(node: any) => { refs.current[field] = node; }} error={errors[field]} keyboardType={keyboardFor(field)} multiline={["subjectsField", "qualifications", "engineTypePower", "ownerOperator", "experienceCategories", "signOffReason"].includes(field)} label={field.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase())} value={String(form[field] ?? "")} onChangeText={(value) => change(field, value)} />; })}{saved && <Text accessibilityLiveRegion="polite" style={{ color: palette.teal, fontWeight: "800", marginTop: 12 }}>Saved</Text>}<Button testID="crew-save-button" title={saving ? "Saving..." : saved ? "Saved" : "Save record"} onPress={save} disabled={saving || saved} />{isNew && attachmentRules ? <Text style={[styles.subtitle, { marginTop: 18 }]}>Save before adding files</Text> : null}{canReadFiles ? <CrewAttachments collection={attachmentCollection} parentUuid={parentUuid} writable={canWriteFiles} maxBytes={attachmentRules?.maxBytes} /> : null}{!isNew && <Button testID="crew-delete-button" title="Delete record" secondary onPress={remove} /> }<Button testID="crew-back-button" title="Back" secondary onPress={cancel} /></ScrollView>;
}