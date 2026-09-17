import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { palette } from "../components/CrewUI";

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>CREW SUPPORT</Text>
      <Text style={styles.heading}>More from SAIL Crew</Text>
      <Text style={styles.subheading}>Useful links and help for life around your records.</Text>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "about_us" })}>
         <Text style={styles.itemText}>About us</Text><Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "contact_us" })}>
         <Text style={styles.itemText}>Contact us</Text><Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "forum" })}>
         <Text style={styles.itemText}>Forum</Text><Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={[styles.item, styles.logout]} onPress={() => logout()} testID="logout-button">
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.mist, padding: 20 },
  kicker: { color: palette.teal, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 8 },
  heading: { color: palette.navy, fontSize: 28, fontWeight: "800", marginTop: 8 },
  subheading: { color: palette.muted, lineHeight: 20, marginTop: 6, marginBottom: 18 },
  item: { padding: 18, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, borderRadius: 13, marginBottom: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemText: { fontSize: 16, color: palette.ink, fontWeight: "800" },
  chevron: { color: palette.teal, fontSize: 27, lineHeight: 24 },
  logout: { marginTop: 14, backgroundColor: "#FFF7F4", borderColor: "#E9C9C2" },
  logoutText: { fontSize: 15, color: palette.red, fontWeight: "800" },
});
