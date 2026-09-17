import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { notificationsApi } from "../api/notificationsApi";

interface WelcomeBannerProps {
  onPressBell: () => void;
}

export default function WelcomeBanner({ onPressBell }: WelcomeBannerProps) {
  const { firstName, familyName } = useAuth();
  const [now, setNow] = useState(new Date());
  const [unreadCount, setUnreadCount] = useState(0);

  const name = `${firstName ?? ""} ${familyName ?? ""}`.trim() || "Crew Member";

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    notificationsApi
      .unreadCount()
      .then(setUnreadCount)
      .catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.welcome}>Welcome, {name}</Text>
        <Text style={styles.dateTime}>{now.toLocaleString()}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} style={styles.bell} onPress={onPressBell} testID="notifications-bell">
        <View style={styles.bellDome} />
        <View style={styles.bellClapper} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#082B49",
  },
  welcome: { fontSize: 18, fontWeight: "600", color: "#fff" },
  dateTime: { fontSize: 13, color: "#e6fff2", marginTop: 2 },
  bell: { minWidth: 48, minHeight: 48, borderRadius: 14, backgroundColor: "#0B5681", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3A7897" },
  bellDome: { width: 19, height: 19, borderWidth: 2, borderColor: "#FFF", borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  bellClapper: { width: 7, height: 3, borderRadius: 3, backgroundColor: "#FFF", marginTop: 2 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#c00",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
