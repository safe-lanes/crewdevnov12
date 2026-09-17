import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "about_us" })}>
        <Text style={styles.itemText}>About Us</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "contact_us" })}>
        <Text style={styles.itemText}>Contact Us</Text>
      </Pressable>
      <Pressable style={styles.item} onPress={() => navigation.navigate("ContentPage", { pageKey: "forum" })}>
        <Text style={styles.itemText}>Forum</Text>
      </Pressable>

      <Pressable style={[styles.item, styles.logout]} onPress={() => logout()} testID="logout-button">
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  item: { padding: 18, borderBottomWidth: 1, borderBottomColor: "#eee" },
  itemText: { fontSize: 16 },
  logout: { marginTop: 24, borderBottomWidth: 0 },
  logoutText: { fontSize: 16, color: "#c00", fontWeight: "600" },
});
