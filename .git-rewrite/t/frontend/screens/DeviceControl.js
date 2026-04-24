import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../firebaseConfig';
import { ref, onValue, query, limitToLast, get } from 'firebase/database';
import { API_ENDPOINTS } from '../config';

export default function DeviceControl() {
  const [prediction, setPrediction] = useState(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Last prediction from history
  const [lastPrediction, setLastPrediction] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Prediction mode toggle
  const [predMode, setPredMode] = useState('ml');
  const [modeLoading, setModeLoading] = useState(false);

  // Fetch current mode on mount
  useEffect(() => {
    fetch(API_ENDPOINTS.PREDICTION_MODE)
      .then(r => r.json())
      .then(j => { if (j.mode) setPredMode(j.mode); })
      .catch(() => {});
  }, []);

  const togglePredMode = async () => {
    const newMode = predMode === 'ml' ? 'rule' : 'ml';
    setModeLoading(true);
    try {
      await fetch(API_ENDPOINTS.PREDICTION_MODE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      setPredMode(newMode);
    } catch (e) {
      console.error('Error toggling mode:', e);
    }
    setModeLoading(false);
  };

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Firebase listener on /stressPPG/prediction — fires only when data changes
  useEffect(() => {
    const predRef = ref(database, 'stressPPG/prediction');

    const unsubscribe = onValue(predRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrediction(data);

        // Check if fresh (within last 30s)
        const now = Date.now() / 1000;
        if (data.last_updated && (now - data.last_updated) < 30) {
          setIsDeviceOnline(true);
        } else {
          setIsDeviceOnline(false);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase prediction listener error:", error);
      setIsDeviceOnline(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch last prediction from prediction_history (on-demand, not continuous)
  const fetchLastPrediction = async () => {
    setHistoryLoading(true);
    try {
      const histRef = query(
        ref(database, 'stressPPG/prediction_history'),
        limitToLast(1)
      );
      const snapshot = await get(histRef);
      const data = snapshot.val();
      if (data) {
        const entries = Object.values(data);
        if (entries.length > 0) {
          setLastPrediction(entries[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching last prediction:", error);
    }
    setHistoryLoading(false);
  };

  // Extract values from prediction
  const bpm = prediction?.bpm || 0;
  const rmssd = prediction?.hrv ? Number(prediction.hrv).toFixed(1) : '0.0';
  // Note: backend writes bpm, hrv (=rmssd), spo2, respiration to /prediction
  // For sdnn, pnn50, lf_hf we need prediction_history or the latest result
  // The /prediction node doesn't store all HRV params, but prediction_history does

  const getStressColor = (stress) => {
    if (!stress) return '#64748b';
    const s = stress.toLowerCase();
    if (s.includes('time pressure') || s.includes('high')) return '#ef4444';
    if (s.includes('interruption') || s.includes('elevated')) return '#f59e0b';
    if (s.includes('normal') || s.includes('calm')) return '#13ec5b';
    if (s.includes('low') || s.includes('relax')) return '#22d3ee';
    if (s === 'idle') return '#64748b';
    return '#38bdf8';
  };

  const getStressIcon = (stress) => {
    if (!stress) return 'hourglass-empty';
    const s = stress.toLowerCase();
    if (s.includes('time pressure') || s.includes('high')) return 'warning';
    if (s.includes('interruption')) return 'notifications-active';
    if (s.includes('normal') || s.includes('calm')) return 'check-circle';
    if (s.includes('low') || s.includes('relax')) return 'sentiment-satisfied';
    if (s === 'idle') return 'hourglass-empty';
    return 'insights';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '--';
    const d = new Date(timestamp * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const stress = prediction?.stress || 'Waiting...';
  const warning = prediction?.warning || 'Place finger on sensor';
  const confidence = prediction?.confidence;
  const stressColor = getStressColor(stress);

  const isWarning = stress && (
    stress.toLowerCase().includes('time pressure') ||
    stress.toLowerCase().includes('interruption') ||
    stress.toLowerCase().includes('high') ||
    stress.toLowerCase().includes('elevated')
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBg}>
            <MaterialIcons name="monitor-heart" size={24} color="#13ec5b" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Stress Monitor</Text>
            <Text style={styles.headerSubtitle}>LIVE ANALYSIS</Text>
          </View>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isDeviceOnline ? '#13ec5b' : '#ef4444' }]} />
          <Text style={styles.statusText}>{isDeviceOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ─── Live Stress Hero Card ─── */}
        <View style={[styles.stressHeroCard, { borderColor: `${stressColor}30` }]}>
          <View style={styles.stressHeroInner}>
            <Animated.View style={[
              styles.stressCircle,
              { borderColor: stressColor, transform: [{ scale: pulseAnim }] }
            ]}>
              <MaterialIcons name={getStressIcon(stress)} size={40} color={stressColor} />
            </Animated.View>
            <View style={styles.stressInfo}>
              <Text style={styles.stressLabel}>CURRENT STATE</Text>
              <Text style={[styles.stressValue, { color: stressColor }]}>
                {loading ? '...' : stress}
              </Text>
              {confidence && (
                <Text style={styles.confidenceText}>
                  Confidence: {confidence}%
                </Text>
              )}
            </View>
          </View>

          {/* ML Warning Banner */}
          {warning && (
            <View style={[
              styles.warningBanner,
              isWarning && styles.warningBannerAlert,
            ]}>
              <MaterialIcons
                name={isWarning ? "warning" : "info-outline"}
                size={18}
                color={isWarning ? '#fbbf24' : 'rgba(255,255,255,0.5)'}
              />
              <Text style={[
                styles.warningText,
                isWarning && styles.warningTextAlert,
              ]}>
                {warning}
              </Text>
            </View>
          )}
        </View>

        {/* ─── Live Parameters ─── */}
        <Text style={styles.sectionHeader}>LIVE PARAMETERS</Text>
        <View style={styles.hrvGrid}>
          {/* BPM */}
          <View style={[styles.paramCard, styles.paramCardWide]}>
            <View style={styles.paramIconRow}>
              <View style={[styles.paramIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <MaterialIcons name="favorite" size={20} color="#ef4444" />
              </View>
              <Text style={styles.paramName}>BPM</Text>
            </View>
            <View style={styles.paramValueRow}>
              <Text style={[styles.paramValue, { color: '#ef4444' }]}>{isDeviceOnline ? bpm : '--'}</Text>
              <Text style={styles.paramUnit}>bpm</Text>
            </View>
            <View style={styles.paramBar}>
              <View style={[styles.paramBarFill, { width: `${Math.min((bpm / 180) * 100, 100)}%`, backgroundColor: '#ef4444' }]} />
            </View>
          </View>

          {/* HRV (RMSSD) */}
          <View style={styles.paramCard}>
            <View style={styles.paramIconRow}>
              <View style={[styles.paramIconBg, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                <MaterialIcons name="graphic-eq" size={18} color="#38bdf8" />
              </View>
              <Text style={styles.paramName}>HRV</Text>
            </View>
            <View style={styles.paramValueRow}>
              <Text style={[styles.paramValue, { color: '#38bdf8' }]}>{isDeviceOnline ? rmssd : '--'}</Text>
              <Text style={styles.paramUnit}>ms</Text>
            </View>
            <View style={styles.paramBar}>
              <View style={[styles.paramBarFill, { width: `${Math.min((parseFloat(rmssd) / 200) * 100, 100)}%`, backgroundColor: '#38bdf8' }]} />
            </View>
          </View>

          {/* SpO2 */}
          <View style={styles.paramCard}>
            <View style={styles.paramIconRow}>
              <View style={[styles.paramIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
                <MaterialIcons name="water-drop" size={18} color="#ec4899" />
              </View>
              <Text style={styles.paramName}>SpO2</Text>
            </View>
            <View style={styles.paramValueRow}>
              <Text style={[styles.paramValue, { color: '#ec4899' }]}>{isDeviceOnline ? (prediction?.spo2 || '--') : '--'}</Text>
              <Text style={styles.paramUnit}>%</Text>
            </View>
            <View style={styles.paramBar}>
              <View style={[styles.paramBarFill, { width: `${Math.min(((prediction?.spo2 || 0) / 100) * 100, 100)}%`, backgroundColor: '#ec4899' }]} />
            </View>
          </View>
        </View>

        {/* ─── Prediction Mode Toggle ─── */}
        <Text style={styles.sectionHeader}>PREDICTION ENGINE</Text>
        <View style={styles.modeToggleCard}>
          <View style={styles.modeToggleInfo}>
            <MaterialIcons
              name={predMode === 'ml' ? 'psychology' : 'tune'}
              size={24}
              color={predMode === 'ml' ? '#a855f7' : '#fbbf24'}
            />
            <View style={{flex: 1}}>
              <Text style={styles.modeToggleTitle}>
                {predMode === 'ml' ? 'ML Model (RF + XGBoost)' : 'Rule-Based (Thresholds)'}
              </Text>
              <Text style={styles.modeToggleDesc}>
                {predMode === 'ml'
                  ? 'Ensemble ML prediction using trained models'
                  : 'HRV threshold scoring - no models needed'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.modeToggleBtn, predMode === 'rule' && styles.modeToggleBtnRule]}
            onPress={togglePredMode}
            disabled={modeLoading}
          >
            {modeLoading ? (
              <ActivityIndicator size="small" color="#0a0f0c" />
            ) : (
              <>
                <MaterialIcons
                  name={predMode === 'ml' ? 'swap-horiz' : 'swap-horiz'}
                  size={18}
                  color="#0a0f0c"
                />
                <Text style={styles.modeToggleBtnText}>
                  Switch to {predMode === 'ml' ? 'Rule-Based' : 'ML Model'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Fetch Last Prediction Button ─── */}
        <TouchableOpacity
          style={styles.fetchButton}
          onPress={fetchLastPrediction}
          disabled={historyLoading}
        >
          {historyLoading ? (
            <ActivityIndicator size="small" color="#0a0f0c" />
          ) : (
            <View style={styles.fetchButtonIcon}>
              <MaterialIcons name="history" size={22} color="#0a0f0c" />
            </View>
          )}
          <Text style={styles.fetchButtonText}>
            {historyLoading ? 'Fetching...' : 'Get Last Prediction from DB'}
          </Text>
        </TouchableOpacity>

        {/* ─── Last Prediction Card ─── */}
        {lastPrediction && (
          <View style={[styles.lastPredCard, { borderLeftColor: getStressColor(lastPrediction.stress) }]}>
            <View style={styles.lastPredHeader}>
              <View style={styles.lastPredBadge}>
                <MaterialIcons name="storage" size={14} color="#0a0f0c" />
                <Text style={styles.lastPredBadgeText}>FROM DATABASE</Text>
              </View>
              <Text style={styles.lastPredTime}>{formatTime(lastPrediction.timestamp)}</Text>
            </View>

            <View style={styles.lastPredBody}>
              <View style={styles.lastPredRow}>
                <MaterialIcons name={getStressIcon(lastPrediction.stress)} size={28} color={getStressColor(lastPrediction.stress)} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lastPredStress, { color: getStressColor(lastPrediction.stress) }]}>
                    {lastPrediction.stress}
                  </Text>
                  <Text style={styles.lastPredWarning}>{lastPrediction.warning}</Text>
                </View>
                {lastPrediction.confidence && (
                  <View style={styles.lastPredConfBadge}>
                    <Text style={styles.lastPredConfText}>{lastPrediction.confidence}%</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.lastPredMetrics}>
              {[
                { label: 'BPM', value: lastPrediction.bpm || '--' },
                { label: 'RMSSD', value: Number(lastPrediction.rmssd || 0).toFixed(1) },
                { label: 'SDNN', value: Number(lastPrediction.sdnn || 0).toFixed(1) },
                { label: 'pNN50', value: Number(lastPrediction.pnn50 || 0).toFixed(1) },
                { label: 'LF/HF', value: Number(lastPrediction.lf_hf || 0).toFixed(2) },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <View style={styles.lastPredMetricItem}>
                    <Text style={styles.lastPredMetricLabel}>{item.label}</Text>
                    <Text style={styles.lastPredMetricValue}>{item.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.lastPredDivider} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0c' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBg: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(19, 236, 91, 0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(19, 236, 91, 0.2)',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSubtitle: { color: '#13ec5b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  connectionStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 40 },

  stressHeroCard: {
    backgroundColor: '#111813', borderRadius: 24, padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  stressHeroInner: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
  stressCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  stressInfo: { flex: 1 },
  stressLabel: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
  stressValue: { fontSize: 28, fontWeight: 'bold', textTransform: 'capitalize' },
  confidenceText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  warningBannerAlert: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  warningText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1, fontWeight: '500' },
  warningTextAlert: { color: '#fbbf24', fontWeight: '600' },

  sectionHeader: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12, marginTop: 4 },

  hrvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  paramCard: {
    width: '48%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  paramCardWide: { width: '100%' },
  paramIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  paramIconBg: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paramName: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8 },
  paramValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  paramValue: { fontSize: 26, fontWeight: 'bold' },
  paramUnit: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 'bold' },
  paramBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  paramBarFill: { height: '100%', borderRadius: 2, opacity: 0.7 },

  fetchButton: {
    backgroundColor: '#13ec5b', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20,
  },
  fetchButtonIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  fetchButtonText: { color: '#0a0f0c', fontSize: 15, fontWeight: 'bold' },

  lastPredCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderLeftWidth: 4, marginBottom: 16,
  },
  lastPredHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  lastPredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fbbf24', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  lastPredBadgeText: { color: '#0a0f0c', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  lastPredTime: { color: '#64748b', fontSize: 11, fontWeight: '500' },
  lastPredBody: { marginBottom: 14 },
  lastPredRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lastPredStress: { fontSize: 20, fontWeight: 'bold', textTransform: 'capitalize' },
  lastPredWarning: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  lastPredConfBadge: { backgroundColor: 'rgba(19,236,91,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  lastPredConfText: { color: '#13ec5b', fontSize: 14, fontWeight: 'bold' },
  lastPredMetrics: {
    flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12,
    justifyContent: 'space-around', alignItems: 'center',
  },
  lastPredMetricItem: { alignItems: 'center', gap: 4 },
  lastPredMetricLabel: { color: '#475569', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  lastPredMetricValue: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 'bold' },
  lastPredDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Mode toggle
  modeToggleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  modeToggleInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  modeToggleTitle: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  modeToggleDesc: { color: '#64748b', fontSize: 11, marginTop: 2 },
  modeToggleBtn: {
    backgroundColor: '#a855f7', borderRadius: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modeToggleBtnRule: {
    backgroundColor: '#fbbf24',
  },
  modeToggleBtnText: { color: '#0a0f0c', fontSize: 13, fontWeight: 'bold' },
});
