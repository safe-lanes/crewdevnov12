import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette } from "../components/CrewUI";
import { privacyApi, type PrivacyRequest } from "../api/privacyApi";

const choices = [["access", "Access my data"], ["export", "Export my data"], ["correction", "Correct my data"], ["deletion", "Delete my app account and eligible data"]] as const;
export default function PrivacyRequestsScreen() {
  const [items, setItems] = useState<PrivacyRequest[]>([]); const [busy, setBusy] = useState(false);
  const load = useCallback(() => privacyApi.list().then(setItems).catch(e => Alert.alert("Unable to load", e.message)), []);
  useEffect(() => { void load(); }, [load]);
  const submit = async (type: typeof choices[number][0]) => { setBusy(true); try { await privacyApi.create(type); await load(); Alert.alert("Request submitted", "Your request will be reviewed. No ERP record is considered deleted until the request is completed."); } catch (e: any) { Alert.alert("Unable to submit", e.message); } finally { setBusy(false); } };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.note}>Submit and track privacy requests. Account deletion disables your mobile account and erases eligible app data after verification. Employment, safety, legal, or maritime records may have to be retained and will be identified in the result.</Text>
    {choices.map(([type, label]) => <Pressable key={type} disabled={busy} style={styles.button} onPress={() => submit(type)}><Text style={styles.buttonText}>{label}</Text></Pressable>)}
    <Text style={styles.heading}>Request status</Text>
    {items.map(item => <View key={item.requestUuid} style={styles.card}><Text style={styles.kind}>{item.requestType.toUpperCase()}</Text><Text style={styles.status}>{item.status.replace(/_/g, " ")}</Text>{item.legalHold ? <Text style={styles.warning}>Retention/legal hold applies</Text> : null}{item.resolutionNotes ? <Text>{item.resolutionNotes}</Text> : null}</View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:palette.mist},content:{padding:20},note:{color:palette.ink,lineHeight:20,marginBottom:14},button:{backgroundColor:palette.navy,padding:15,borderRadius:10,marginBottom:8},buttonText:{color:palette.white,fontWeight:"800"},heading:{fontSize:18,fontWeight:"800",color:palette.navy,marginTop:18,marginBottom:8},card:{backgroundColor:palette.white,borderColor:palette.line,borderWidth:1,borderRadius:10,padding:14,marginBottom:8},kind:{fontWeight:"800",color:palette.ink},status:{color:palette.teal,fontWeight:"700",textTransform:"capitalize"},warning:{color:palette.red,marginTop:5} });
