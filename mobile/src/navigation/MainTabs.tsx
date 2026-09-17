import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useWindowDimensions, View, Text, StyleSheet } from "react-native";
import { palette } from "../components/CrewUI";
import HomeScreen from "../screens/HomeScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import NoticesListScreen from "../screens/NoticesListScreen";
import NoticeDetailScreen from "../screens/NoticeDetailScreen";
import AdminNoticeEditScreen from "../screens/admin/AdminNoticeEditScreen";
import MoreScreen from "../screens/MoreScreen";
import ContentPageScreen from "../screens/ContentPageScreen";
import AdminContentEditScreen from "../screens/admin/AdminContentEditScreen";
import CrewProfileScreen from "../screens/CrewProfileScreen";
import CrewCollectionScreen from "../screens/CrewCollectionScreen";

const HomeStack = createNativeStackNavigator();
const stackScreenOptions = {
  headerStyle: { backgroundColor: palette.navy },
  headerTintColor: palette.white,
  headerTitleStyle: { fontWeight: "800" as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: palette.mist },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ title: "Home", headerShown: false }} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <HomeStack.Screen name="CrewProfile" component={CrewProfileScreen} options={{ title: "My Profile" }} />
      <HomeStack.Screen name="CrewCollection" component={CrewCollectionScreen} options={{ title: "Crew records" }} />
    </HomeStack.Navigator>
  );
}

const NoticesStack = createNativeStackNavigator();
function NoticesStackNavigator() {
  return (
    <NoticesStack.Navigator screenOptions={stackScreenOptions}>
      <NoticesStack.Screen name="NoticesList" component={NoticesListScreen} options={{ title: "Notices" }} />
      <NoticesStack.Screen name="NoticeDetail" component={NoticeDetailScreen} options={{ title: "Notice" }} />
      <NoticesStack.Screen
        name="AdminNoticeEdit"
        component={AdminNoticeEditScreen}
        options={{ title: "Edit Notice" }}
      />
    </NoticesStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator();
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={stackScreenOptions}>
      <MoreStack.Screen name="MoreMain" component={MoreScreen} options={{ title: "More" }} />
      <MoreStack.Screen name="ContentPage" component={ContentPageScreen} options={{ title: "" }} />
      <MoreStack.Screen
        name="AdminContentEdit"
        component={AdminContentEditScreen}
        options={{ title: "Edit Page" }}
      />
    </MoreStack.Navigator>
  );
}

const AlertsStack = createNativeStackNavigator();
function AlertsStackNavigator() {
  return (
    <AlertsStack.Navigator screenOptions={stackScreenOptions}>
      <AlertsStack.Screen name="AlertsMain" component={NotificationsScreen} options={{ title: "Alerts" }} />
    </AlertsStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();
type NavIconKind = "helm" | "document" | "bell" | "grid";

const navItems: Record<string, { label: string; icon: NavIconKind }> = {
  Home: { label: "Overview", icon: "helm" },
  Notices: { label: "Notices", icon: "document" },
  NotificationsTab: { label: "Alerts", icon: "bell" },
  More: { label: "More", icon: "grid" },
};

function NavIcon({ kind, focused, color }: { kind: NavIconKind; focused: boolean; color: string }) {
  const stroke = focused ? palette.teal : color;
  return (
    <View style={[styles.mark, focused && styles.markActive]} accessible={false}>
      {kind === "helm" ? (
        <View style={[styles.helmRing, { borderColor: stroke }]}>
          <View style={[styles.helmVertical, { backgroundColor: stroke }]} />
          <View style={[styles.helmHorizontal, { backgroundColor: stroke }]} />
          <View style={[styles.helmHub, { backgroundColor: stroke }]} />
        </View>
      ) : null}
      {kind === "document" ? (
        <View style={[styles.document, { borderColor: stroke }]}>
          <View style={[styles.documentLine, { backgroundColor: stroke, width: 11 }]} />
          <View style={[styles.documentLine, { backgroundColor: stroke, width: 8 }]} />
          <View style={[styles.documentLine, { backgroundColor: stroke, width: 10 }]} />
        </View>
      ) : null}
      {kind === "bell" ? (
        <View style={styles.bell}>
          <View style={[styles.bellDome, { borderColor: stroke }]} />
          <View style={[styles.bellBase, { backgroundColor: stroke }]} />
          <View style={[styles.bellClapper, { backgroundColor: stroke }]} />
        </View>
      ) : null}
      {kind === "grid" ? (
        <View style={styles.gridIcon}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={[styles.gridCell, { borderColor: stroke }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MainTabs() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 760 && height >= 600;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: wide ? "left" : "bottom",
        tabBarLabelPosition: wide ? "beside-icon" : "below-icon",
        tabBarShowLabel: true,
        tabBarStyle: wide ? styles.sidebar : styles.bottomBar,
        tabBarLabelStyle: wide ? styles.sideLabel : styles.bottomLabel,
        tabBarActiveTintColor: wide ? palette.white : palette.teal,
        tabBarInactiveTintColor: wide ? "#88A8B8" : palette.muted,
        tabBarActiveBackgroundColor: wide ? "#1B4B65" : "transparent",
        tabBarItemStyle: wide ? styles.sideItem : styles.bottomItem,
        tabBarIcon: ({ focused, color }) => <NavIcon kind={navItems[route.name].icon} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ tabBarLabel: "Overview" }} />
      <Tab.Screen name="Notices" component={NoticesStackNavigator} options={{ tabBarLabel: "Notices" }} />
      <Tab.Screen name="NotificationsTab" component={AlertsStackNavigator} options={{ title: "Alerts", tabBarLabel: "Alerts" }} />
      <Tab.Screen name="More" component={MoreStackNavigator} options={{ tabBarLabel: "More" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 220, backgroundColor: palette.navy, borderRightWidth: 1, borderRightColor: "#244D64", paddingTop: 22, paddingBottom: 22 },
  sideItem: { minHeight: 62, marginHorizontal: 12, marginVertical: 3, borderRadius: 10, paddingHorizontal: 12 },
  sideLabel: { fontSize: 14, fontWeight: "800", marginLeft: 8 },
  bottomBar: { minHeight: 64, backgroundColor: palette.white, borderTopColor: palette.line, paddingTop: 6 },
  bottomItem: { minHeight: 50 },
  bottomLabel: { fontSize: 11, fontWeight: "800" },
  mark: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  markActive: { backgroundColor: "#D9F0F0" },
  helmRing: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, alignItems: "center", justifyContent: "center" },
  helmVertical: { position: "absolute", width: 1.7, height: 24 },
  helmHorizontal: { position: "absolute", width: 24, height: 1.7 },
  helmHub: { width: 5, height: 5, borderRadius: 3 },
  document: { width: 18, height: 22, borderWidth: 1.8, borderRadius: 2.5, paddingHorizontal: 3, paddingTop: 5, gap: 3 },
  documentLine: { height: 1.6, borderRadius: 1 },
  bell: { width: 22, height: 23, alignItems: "center", justifyContent: "flex-end" },
  bellDome: { position: "absolute", top: 2, width: 17, height: 17, borderWidth: 1.8, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomWidth: 0 },
  bellBase: { width: 21, height: 1.8, borderRadius: 1, marginBottom: 3 },
  bellClapper: { width: 5, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  gridIcon: { width: 20, height: 20, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  gridCell: { width: 8.5, height: 8.5, borderRadius: 2, borderWidth: 1.7 },
});
