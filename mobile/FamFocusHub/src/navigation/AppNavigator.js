import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import ParentDashboard from '../screens/ParentDashboard';
import ChildSpace from '../screens/ChildSpace';
import ChatScreen from '../screens/ChatScreen';
import ChoresScreen from '../screens/ChoresScreen';
import CalendarScreen from '../screens/CalendarScreen';
import RewardsScreen from '../screens/RewardsScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FamilyScreen from '../screens/FamilyScreen';

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
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Chores':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Calendar':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'More':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            default:
              iconName = 'home';
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
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'MySpace':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Chores':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Rewards':
              iconName = focused ? 'gift' : 'gift-outline';
              break;
            case 'More':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            default:
              iconName = 'home';
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

export default function AppNavigator() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user?.role === 'parent' ? (
          <>
            <Stack.Screen name="ParentMain" component={ParentTabs} />
            <Stack.Screen name="Family" component={FamilyScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="ChildMain" component={ChildTabs} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
