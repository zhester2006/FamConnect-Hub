import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import PixieAssistant from '../components/PixieAssistant';

// Screens
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ParentDashboard from '../screens/ParentDashboard';
import ChildSpace from '../screens/ChildSpace';
import ChatScreen from '../screens/ChatScreen';
import ChoresScreen from '../screens/ChoresScreen';
import CalendarScreen from '../screens/CalendarScreen';
import RewardsScreen from '../screens/RewardsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FamilyScreen from '../screens/FamilyScreen';
import FamilyWallScreen from '../screens/FamilyWallScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import DinnerPlannerScreen from '../screens/DinnerPlannerScreen';
import LocationScreen from '../screens/LocationScreen';
import ReadingLogsScreen from '../screens/ReadingLogsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import HomeHubScreen from '../screens/HomeHubScreen';
import AchievementsScreen from '../screens/AchievementsScreen';
import WidgetSettingsScreen from '../screens/WidgetSettingsScreen';
import PantryScreen from '../screens/PantryScreen';
import CheckinLogScreen from '../screens/CheckinLogScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ParentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e1b4b',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          switch (route.name) {
            case 'Home': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Chores': iconName = focused ? 'checkbox' : 'checkbox-outline'; break;
            case 'Chat': iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'; break;
            case 'Calendar': iconName = focused ? 'calendar' : 'calendar-outline'; break;
            case 'More': iconName = focused ? 'grid' : 'grid-outline'; break;
            default: iconName = 'home';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={ParentDashboard} />
      <Tab.Screen name="Chores" component={ChoresScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="More" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function ChildTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#064e3b',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#6b7280',
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          switch (route.name) {
            case 'MySpace': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Chores': iconName = focused ? 'checkbox' : 'checkbox-outline'; break;
            case 'Chat': iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'; break;
            case 'Rewards': iconName = focused ? 'gift' : 'gift-outline'; break;
            case 'More': iconName = focused ? 'grid' : 'grid-outline'; break;
            default: iconName = 'home';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="MySpace" component={ChildSpace} options={{ title: 'My Space' }} />
      <Tab.Screen name="Chores" component={ChoresScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="More" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function OnboardingWrapper({ children, onComplete }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const data = await apiService.getTutorialContent();
      setShowOnboarding(!data.completed && data.slides?.length > 0);
    } catch (error) {
      setShowOnboarding(false);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  if (checkingOnboarding) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen 
        onComplete={() => {
          setShowOnboarding(false);
          onComplete?.();
        }} 
      />
    );
  }

  return children;
}

export default function AppNavigator() {
  const { isAuthenticated, user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#818cf8" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : (
            <>
              {user?.role === 'parent' ? (
                <>
                  <Stack.Screen name="ParentMain">
                    {() => (
                      <OnboardingWrapper onComplete={() => setOnboardingComplete(true)}>
                        <ParentTabs />
                      </OnboardingWrapper>
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Family" component={FamilyScreen} />
                  <Stack.Screen name="FamilyWall" component={FamilyWallScreen} />
                  <Stack.Screen name="Shopping" component={ShoppingListScreen} />
                  <Stack.Screen name="DinnerPlanner" component={DinnerPlannerScreen} />
                  <Stack.Screen name="Location" component={LocationScreen} />
                  <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="ReadingLogs" component={ReadingLogsScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="HomeHub" component={HomeHubScreen} />
                  <Stack.Screen name="ChildSpace" component={ChildSpace} />
                  <Stack.Screen name="Rewards" component={RewardsScreen} />
                  <Stack.Screen name="Achievements" component={AchievementsScreen} />
                  <Stack.Screen name="WidgetSettings" component={WidgetSettingsScreen} />
                  <Stack.Screen name="Pantry" component={PantryScreen} />
                </>
              ) : (
                <>
                  <Stack.Screen name="ChildMain">
                    {() => (
                      <OnboardingWrapper onComplete={() => setOnboardingComplete(true)}>
                        <ChildTabs />
                      </OnboardingWrapper>
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="FamilyWall" component={FamilyWallScreen} />
                  <Stack.Screen name="Shopping" component={ShoppingListScreen} />
                  <Stack.Screen name="Location" component={LocationScreen} />
                  <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
                  <Stack.Screen name="Settings" component={SettingsScreen} />
                  <Stack.Screen name="ReadingLogs" component={ReadingLogsScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="HomeHub" component={HomeHubScreen} />
                  <Stack.Screen name="Calendar" component={CalendarScreen} />
                  <Stack.Screen name="DinnerPlanner" component={DinnerPlannerScreen} />
                  <Stack.Screen name="Achievements" component={AchievementsScreen} />
                  <Stack.Screen name="WidgetSettings" component={WidgetSettingsScreen} />
                  <Stack.Screen name="Pantry" component={PantryScreen} />
                </>
              )}
            </>
          )}
        </Stack.Navigator>
        
        {/* Pixie AI Assistant - appears on all authenticated screens */}
        {isAuthenticated && <PixieAssistant />}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0d1a',
  },
  loadingText: {
    color: '#a5b4fc',
    marginTop: 16,
    fontSize: 16,
  },
});
