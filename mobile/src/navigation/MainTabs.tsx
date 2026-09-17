import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import NoticesListScreen from "../screens/NoticesListScreen";
import NoticeDetailScreen from "../screens/NoticeDetailScreen";
import AdminNoticeEditScreen from "../screens/admin/AdminNoticeEditScreen";
import MoreScreen from "../screens/MoreScreen";
import ContentPageScreen from "../screens/ContentPageScreen";
import AdminContentEditScreen from "../screens/admin/AdminContentEditScreen";

const HomeStack = createNativeStackNavigator();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ title: "Home", headerShown: false }} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
    </HomeStack.Navigator>
  );
}

const NoticesStack = createNativeStackNavigator();
function NoticesStackNavigator() {
  return (
    <NoticesStack.Navigator>
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
    <MoreStack.Navigator>
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

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Notices" component={NoticesStackNavigator} />
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}
