import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, 
  Modal, ActivityIndicator, Alert, FlatList 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api.service';
import { formatDate, formatDuration, getRelativeTime } from '../utils/dateUtils';

export default function ReadingLogsScreen({ navigation }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [formData, setFormData] = useState({
    book_title: '',
    summary: '',
    pages_read: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchLogs();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await apiService.get('/reading-logs');
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch reading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = () => {
    pauseTimer();
    setTimerSeconds(0);
  };

  const handleSubmit = async () => {
    if (!formData.book_title.trim()) {
      Alert.alert('Error', 'Please enter a book title');
      return;
    }
    if (!formData.summary.trim()) {
      Alert.alert('Error', 'Please enter a summary of what you read');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/reading-logs', {
        book_title: formData.book_title,
        summary: formData.summary,
        pages_read: parseInt(formData.pages_read) || 0,
        reading_time: timerSeconds,
      });
      
      Alert.alert('Success', 'Reading log submitted for approval!');
      setShowAddModal(false);
      setFormData({ book_title: '', summary: '', pages_read: '' });
      resetTimer();
      fetchLogs();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit reading log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (logId) => {
    try {
      await apiService.put(`/reading-logs/${logId}/approve`, { approved: true });
      Alert.alert('Success', 'Reading log approved!');
      fetchLogs();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve reading log');
    }
  };

  const handleReject = async (logId) => {
    Alert.alert(
      'Reject Reading Log',
      'Are you sure you want to reject this reading log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.put(`/reading-logs/${logId}/approve`, { approved: false });
              fetchLogs();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject reading log');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  const renderLog = ({ item }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <View style={styles.logTitleRow}>
          <Ionicons name="book" size={20} color="#818cf8" />
          <Text style={styles.logTitle} numberOfLines={1}>{item.book_title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <Text style={styles.logSummary} numberOfLines={3}>{item.summary}</Text>
      
      <View style={styles.logStats}>
        {item.pages_read > 0 && (
          <View style={styles.stat}>
            <Ionicons name="document-text-outline" size={14} color="#a5b4fc" />
            <Text style={styles.statText}>{item.pages_read} pages</Text>
          </View>
        )}
        {item.reading_time > 0 && (
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={14} color="#a5b4fc" />
            <Text style={styles.statText}>{formatDuration(item.reading_time)}</Text>
          </View>
        )}
        <View style={styles.stat}>
          <Ionicons name="calendar-outline" size={14} color="#a5b4fc" />
          <Text style={styles.statText}>{getRelativeTime(item.created_at)}</Text>
        </View>
      </View>

      {item.child_name && (
        <View style={styles.childInfo}>
          <Ionicons name="person-outline" size={14} color="#6b7280" />
          <Text style={styles.childName}>{item.child_name}</Text>
        </View>
      )}

      {/* Parent approval buttons */}
      {user?.role === 'parent' && item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleApprove(item.log_id)}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleReject(item.log_id)}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#818cf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e1b4b', '#312e81', '#1e1b4b']} style={styles.gradient} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reading Logs</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Logs List */}
      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.log_id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color="#4b5563" />
            <Text style={styles.emptyText}>No reading logs yet</Text>
            <Text style={styles.emptySubtext}>
              {user?.role === 'child' 
                ? 'Start a reading session and submit for approval!'
                : 'Children will submit reading logs for your approval'}
            </Text>
          </View>
        }
      />

      {/* Add Reading Log Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Reading Log</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Timer Section */}
              <View style={styles.timerSection}>
                <Text style={styles.timerLabel}>Reading Timer</Text>
                <Text style={styles.timerDisplay}>{formatDuration(timerSeconds)}</Text>
                <View style={styles.timerButtons}>
                  {!timerRunning ? (
                    <TouchableOpacity style={styles.timerBtn} onPress={startTimer}>
                      <Ionicons name="play" size={24} color="#fff" />
                      <Text style={styles.timerBtnText}>Start</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.timerBtn, styles.pauseBtn]} onPress={pauseTimer}>
                      <Ionicons name="pause" size={24} color="#fff" />
                      <Text style={styles.timerBtnText}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.timerBtn, styles.resetBtn]} onPress={resetTimer}>
                    <Ionicons name="refresh" size={24} color="#fff" />
                    <Text style={styles.timerBtnText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Form Fields */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Book Title *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.book_title}
                  onChangeText={(text) => setFormData({...formData, book_title: text})}
                  placeholder="Enter book title"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Pages Read</Text>
                <TextInput
                  style={styles.input}
                  value={formData.pages_read}
                  onChangeText={(text) => setFormData({...formData, pages_read: text})}
                  placeholder="Number of pages"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Summary *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.summary}
                  onChangeText={(text) => setFormData({...formData, summary: text})}
                  placeholder="Write a brief summary of what you read..."
                  placeholderTextColor="#6b7280"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity 
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>Submit for Approval</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0d1a' },
  gradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0d1a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addButton: { padding: 8, backgroundColor: '#6366f1', borderRadius: 8 },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#6b7280', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#4b5563', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  logCard: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 16, padding: 16, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 },
  logTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  logSummary: { color: '#a5b4fc', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  logStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#a5b4fc', fontSize: 12 },
  childInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  childName: { color: '#6b7280', fontSize: 12 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  approveBtn: { backgroundColor: '#10b981' },
  rejectBtn: { backgroundColor: '#ef4444' },
  actionBtnText: { color: '#fff', fontWeight: '600' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e1b4b', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  modalBody: { padding: 20 },
  timerSection: { alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: 16, padding: 20, marginBottom: 24 },
  timerLabel: { color: '#a5b4fc', fontSize: 14, marginBottom: 8 },
  timerDisplay: { fontSize: 48, fontWeight: 'bold', color: '#fff', fontVariant: ['tabular-nums'] },
  timerButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  timerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  pauseBtn: { backgroundColor: '#f59e0b' },
  resetBtn: { backgroundColor: '#6b7280' },
  timerBtnText: { color: '#fff', fontWeight: '600' },
  formGroup: { marginBottom: 20 },
  label: { color: '#a5b4fc', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: 'rgba(30, 27, 75, 0.8)', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, marginBottom: 40 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
