import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import widgetService from '../services/widget.service';
import { useTheme } from '../context/ThemeContext';

const AVAILABLE_WIDGETS = [
  {
    id: 'chores',
    name: 'Today\'s Chores',
    description: 'Shows your chores for today with points',
    icon: 'checkmark-circle',
    color: '#f59e0b',
    platforms: ['ios', 'android'],
  },
  {
    id: 'events',
    name: 'Upcoming Events',
    description: 'Shows next 3 family events',
    icon: 'calendar',
    color: '#3b82f6',
    platforms: ['ios', 'android'],
  },
  {
    id: 'points',
    name: 'Points & Ranking',
    description: 'Your current points and leaderboard position',
    icon: 'trophy',
    color: '#eab308',
    platforms: ['ios', 'android'],
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Current weather conditions',
    icon: 'partly-sunny',
    color: '#06b6d4',
    platforms: ['ios', 'android'],
  },
  {
    id: 'family',
    name: 'Family Quick Stats',
    description: 'Overview of family activity',
    icon: 'people',
    color: '#8b5cf6',
    platforms: ['ios', 'android'],
  },
];

export default function WidgetSettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [config, setConfig] = useState({ enabledWidgets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await widgetService.getConfig();
      setConfig(savedConfig);
    } catch (error) {
      console.error('Error loading widget config:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWidget = async (widgetId) => {
    const isEnabled = config.enabledWidgets.includes(widgetId);
    await widgetService.toggleWidget(widgetId, !isEnabled);
    setConfig(prev => ({
      ...prev,
      enabledWidgets: isEnabled
        ? prev.enabledWidgets.filter(id => id !== widgetId)
        : [...prev.enabledWidgets, widgetId],
    }));
  };

  const refreshAllWidgets = async () => {
    try {
      // Trigger refresh for all enabled widgets
      for (const widgetId of config.enabledWidgets) {
        widgetService.triggerWidgetRefresh(widgetId);
      }
      alert('Widgets refreshed! Changes will appear on your home screen shortly.');
    } catch (error) {
      console.error('Error refreshing widgets:', error);
    }
  };

  const renderWidgetCard = (widget) => {
    const isEnabled = config.enabledWidgets.includes(widget.id);
    const isPlatformSupported = widget.platforms.includes(Platform.OS);

    return (
      <View key={widget.id} style={[styles.widgetCard, !isPlatformSupported && styles.disabledCard]}>
        <View style={[styles.iconContainer, { backgroundColor: widget.color + '20' }]}>
          <Ionicons name={widget.icon} size={24} color={widget.color} />
        </View>
        <View style={styles.widgetInfo}>
          <Text style={styles.widgetName}>{widget.name}</Text>
          <Text style={styles.widgetDescription}>{widget.description}</Text>
          {!isPlatformSupported && (
            <Text style={styles.unsupportedText}>Not available on {Platform.OS}</Text>
          )}
        </View>
        <Switch
          value={isEnabled}
          onValueChange={() => toggleWidget(widget.id)}
          disabled={!isPlatformSupported}
          trackColor={{ false: '#4b5563', true: widget.color + '80' }}
          thumbColor={isEnabled ? widget.color : '#9ca3af'}
        />
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home Screen Widgets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#60a5fa" />
          <Text style={styles.infoText}>
            Enable widgets below, then add them to your home screen from your device's widget picker.
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>How to Add Widgets</Text>
          {Platform.OS === 'ios' ? (
            <View style={styles.stepsList}>
              <Text style={styles.stepText}>1. Long press on your home screen</Text>
              <Text style={styles.stepText}>2. Tap the + button in the top left</Text>
              <Text style={styles.stepText}>3. Search for "FamFocus Hub"</Text>
              <Text style={styles.stepText}>4. Choose a widget size and tap "Add Widget"</Text>
            </View>
          ) : (
            <View style={styles.stepsList}>
              <Text style={styles.stepText}>1. Long press on your home screen</Text>
              <Text style={styles.stepText}>2. Tap "Widgets"</Text>
              <Text style={styles.stepText}>3. Find "FamFocus Hub" in the list</Text>
              <Text style={styles.stepText}>4. Drag the widget to your home screen</Text>
            </View>
          )}
        </View>

        {/* Available Widgets */}
        <Text style={styles.sectionTitle}>Available Widgets</Text>
        {AVAILABLE_WIDGETS.map(renderWidgetCard)}

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshButton} onPress={refreshAllWidgets}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Refresh All Widgets</Text>
        </TouchableOpacity>

        {/* Note */}
        <Text style={styles.noteText}>
          Note: Widget data updates automatically every 15 minutes. Use the refresh button above to update immediately.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 18,
  },
  instructionsCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  stepsList: {
    gap: 8,
  },
  stepText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  widgetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.6)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  disabledCard: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  widgetInfo: {
    flex: 1,
  },
  widgetName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  widgetDescription: {
    fontSize: 12,
    color: '#94a3b8',
  },
  unsupportedText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  noteText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
