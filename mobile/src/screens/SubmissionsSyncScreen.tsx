import React from "react";
import { ScrollView, Text, View } from "react-native";
import OutboxStatusCard from "../components/OutboxStatusCard";
import { palette, StateView, styles } from "../components/CrewUI";
import { useCrewInformationQuery } from "../hooks/useCrewInformationQuery";

const SECTIONS: Record<string, string> = { particulars: "Particulars", personal: "Personal details", contact: "Address & contact", family: "Family", "next-of-kin": "Next of kin", "vessel-types": "Vessel types", children: "Children", documents: "Documents", visas: "Visas", education: "Education", licenses: "Licenses", training: "Training", "sea-service": "Sea service" };
const ACTIONS: Record<string, string> = { create: "New entry", update: "Update", delete: "Deletion" };

export default function SubmissionsSyncScreen() {
  const query = useCrewInformationQuery();
  const submissions = query.data?.recentSubmissions || [];
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Submissions & sync</Text>
    <OutboxStatusCard />
    <StateView loading={query.isLoading} error={query.error ? (query.error as Error).message : ""} retry={query.refetch}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent submissions</Text>
        {!submissions.length ? <Text style={styles.cardMeta}>No submissions yet.</Text> : submissions.slice(0, 20).map((item) => {
          const color = item.status === "rejected" ? palette.red : item.status === "pending" ? palette.amber : palette.teal;
          const label = item.status === "rejected" ? "Not approved" : item.status === "pending" ? "Awaiting review" : "Published";
          return <View key={item.pendingUuid} style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 }}>
            <Text style={styles.cardMeta}>{ACTIONS[item.action] || item.action} · {SECTIONS[item.section] || item.section}</Text>
            <Text style={{ color, fontWeight: "800", marginTop: 2 }}>{label}</Text>
            {item.status === "rejected" && item.rejectionReason ? <Text style={styles.cardMeta}>{item.rejectionReason}</Text> : null}
          </View>;
        })}
      </View>
    </StateView>
  </ScrollView>;
}
