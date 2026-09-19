import React, { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import WelcomeBanner from "../components/WelcomeBanner";
import { noticesApi, Notice } from "../api/noticesApi";
import { palette, StateView } from "../components/CrewUI";
import { useAsyncOnFocus } from "../hooks/useAsyncOnFocus";
import { useCrewInformationQuery } from "../hooks/useCrewInformationQuery";

const actions = [
  ["My Profile", "Crew details and family", "profile", "CrewProfile"],
  ["Documents & Visas", "Travel records", "document", "CrewCollection", "documents"],
  ["Training & Licenses", "Certificates and courses", "award", "CrewCollection", "training"],
  ["Sea Service", "Your time at sea", "vessel", "CrewCollection", "sea-service"],
  ["Medical", "Fitness and visits", "medical", "CrewCollection", "medicals"],
  ["Briefings & Debriefings", "Operational handovers", "briefing", "CrewCollection", "briefings"],
] as const;
function CrewIcon({ kind, label }: { kind: string; label: string }) {
  return (
    <View accessible={false} accessibilityElementsHidden style={s.icon}>
      {kind === "profile" && <><View style={s.iconHead} /><View style={s.iconShoulders} /></>}
      {kind === "document" && <><View style={s.iconPage} /><View style={[s.iconLine, { top: 10 }]} /><View style={[s.iconLine, { top: 16 }]} /></>}
      {kind === "award" && <><View style={s.iconAward} /><View style={[s.iconRibbon, { left: 10 }]} /><View style={[s.iconRibbon, { right: 10 }]} /></>}
      {kind === "vessel" && <><View style={s.iconMast} /><View style={s.iconSail} /><View style={s.iconHull} /></>}
      {kind === "medical" && <><View style={s.iconCrossVertical} /><View style={s.iconCrossHorizontal} /></>}
      {kind === "briefing" && <><View style={s.iconBubble} /><View style={[s.iconLine, { top: 10 }]} /><View style={[s.iconLine, { top: 16 }]} /></>}
    </View>
  );
}
export default function HomeScreen() {
  const navigation = useNavigation<any>(); const [notices, setNotices] = useState<Notice[]>([]);
  const infoQuery = useCrewInformationQuery();
  const info = infoQuery.data;
  const { loading: noticesLoading, retry: retryNotices } = useAsyncOnFocus(async () => {
    // Best-effort, same as before: a notices failure shouldn't block the
    // rest of the dashboard — only crew-information (below) surfaces as
    // a real error, notices just falls back to "No recent notices".
    try {
      setNotices((await noticesApi.list({ limit: 3 })).items);
    } catch {
      setNotices([]);
    }
  }, []);
  const loading = infoQuery.isLoading || noticesLoading;
  const error = infoQuery.error ? (infoQuery.error as Error).message : "";
  const load = () => { infoQuery.refetch(); retryNotices(); };
  const sections = info?.sections || {};
  const profileMissing = ["particulars", "personal", "contact"].filter(key => !sections[key]).length;
  const expiryCount = ["travelDocuments", "visas", "licenses", "training"].flatMap(key => sections[key] || []).filter((row: any) => {
    if (!row.expiry) return false;
    const expiry = new Date(row.expiry).getTime();
    return Number.isFinite(expiry) && expiry < Date.now() + 45 * 86400000;
  }).length;
  const nextTitle = profileMissing ? "Complete your profile details" : expiryCount ? "Review expiring qualifications" : "Your core records are up to date";
  const nextMeta = profileMissing ? `${profileMissing} profile areas still need attention` : expiryCount ? `${expiryCount} records expire within 45 days` : "Check notices for your next assignment";
  return <View style={s.screen}><WelcomeBanner onPressBell={() => navigation.navigate("Notifications")} /><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={s.content}><StateView loading={loading} error={error} retry={load}>{<><View style={s.next}><Text style={s.nextTitle}>{nextTitle}</Text><Text style={s.nextMeta}>{nextMeta}</Text></View><Text style={s.section}>Workspace</Text><View style={s.grid}>{actions.map(([label, , icon, screen, collection]) => <Pressable key={label} testID={`dashboard-card-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`} accessibilityRole="button" accessibilityLabel={`Open ${label}`} style={({ pressed }) => [s.action, pressed && s.pressed]} onPress={() => navigation.navigate(screen, collection ? { collection } : undefined)}><CrewIcon kind={icon} label={label} /><Text style={s.actionTitle}>{label}</Text></Pressable>)}</View><View style={s.noticeHead}><Text style={s.section}>Recent notices</Text><Pressable accessibilityRole="button" accessibilityLabel="See all notices" onPress={() => navigation.navigate("Notices")}><Text style={s.seeAll}>See all</Text></Pressable></View>{notices.length ? notices.map(n => <Pressable accessibilityRole="button" accessibilityLabel={`Read notice ${n.title}`} key={n.noticeUuid} style={s.notice} onPress={() => navigation.navigate("Notices", { screen: "NoticeDetail", params: { noticeUuid: n.noticeUuid } })}><Text style={s.noticeTitle}>{n.title}</Text></Pressable>) : <Text style={s.muted}>No recent notices</Text>}</>}</StateView></ScrollView></View>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: palette.mist }, content: { padding: 20, paddingBottom: 40 }, next: { backgroundColor: palette.navy, borderRadius: 16, padding: 18 }, nextTitle: { color: "#FFF", fontWeight: "800", fontSize: 16 }, nextMeta: { color: "#C4D8E0", marginTop: 4 }, section: { color: palette.navy, fontWeight: "800", fontSize: 18, marginTop: 24, marginBottom: 10 }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, action: { width: "48.2%", minHeight: 116, backgroundColor: "#FFF", borderRadius: 15, borderWidth: 1, borderColor: "#D8E6E9", padding: 15, marginBottom: 10, justifyContent: "space-between" }, icon: { width: 38, height: 34, alignItems: "center", justifyContent: "center", marginBottom: 10, position: "relative" }, iconHead: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.teal, position: "absolute", top: 2 }, iconShoulders: { width: 28, height: 14, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 2, borderBottomWidth: 0, borderColor: palette.teal, position: "absolute", bottom: 2 }, iconPage: { width: 24, height: 30, borderRadius: 3, borderWidth: 2, borderColor: palette.teal }, iconLine: { width: 12, height: 2, backgroundColor: palette.teal, position: "absolute" }, iconAward: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.teal, position: "absolute", top: 1 }, iconRibbon: { width: 7, height: 15, borderLeftWidth: 2, borderColor: palette.teal, position: "absolute", bottom: 0, transform: [{ rotate: "12deg" }] }, iconMast: { width: 2, height: 22, backgroundColor: palette.teal, position: "absolute", top: 1, left: 18 }, iconSail: { width: 0, height: 0, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 13, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: palette.teal, position: "absolute", top: 3, left: 20 }, iconHull: { width: 32, height: 9, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderWidth: 2, borderTopWidth: 0, borderColor: palette.teal, position: "absolute", bottom: 1 }, iconCrossVertical: { width: 9, height: 30, borderRadius: 2, backgroundColor: palette.teal, position: "absolute" }, iconCrossHorizontal: { width: 30, height: 9, borderRadius: 2, backgroundColor: palette.teal, position: "absolute" }, iconBubble: { width: 32, height: 26, borderRadius: 6, borderWidth: 2, borderColor: palette.teal }, actionTitle: { color: palette.navy, fontWeight: "800", fontSize: 16, lineHeight: 20 }, pressed: { opacity: .7, transform: [{ scale: .985 }] }, noticeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, seeAll: { color: palette.teal, fontWeight: "800" }, notice: { backgroundColor: "#FFF", borderRadius: 12, padding: 15, borderWidth: 1, borderColor: "#D8E6E9", marginBottom: 8 }, noticeTitle: { color: palette.ink, fontWeight: "700" }, muted: { color: palette.muted } });