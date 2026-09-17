import React, { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import WelcomeBanner from "../components/WelcomeBanner";
import { noticesApi, Notice } from "../api/noticesApi";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [recentNotices, setRecentNotices] = useState<Notice[]>([]);

  useFocusEffect(
    useCallback(() => {
      noticesApi
        .list()
        .then((data) => setRecentNotices(data.slice(0, 3)))
        .catch(() => {});
    }, []),
  );

  return (
    <View style={styles.container}>
      <WelcomeBanner onPressBell={() => navigation.navigate("Notifications")} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Latest Notices</Text>
        {recentNotices.length === 0 ? (
          <Text style={styles.empty}>No notices yet.</Text>
        ) : (
          <FlatList
            data={recentNotices}
            keyExtractor={(item) => item.noticeUuid}
            renderItem={({ item }) => (
              <Pressable
                style={styles.noticeItem}
                onPress={() => navigation.navigate("Notices", { screen: "NoticeDetail", params: { noticeUuid: item.noticeUuid } })}
              >
                <Text style={styles.noticeTitle}>{item.title}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#555", marginBottom: 8 },
  empty: { color: "#888" },
  noticeItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  noticeTitle: { fontSize: 15 },
});
