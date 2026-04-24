import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { database } from '../firebaseConfig';
import { ref, onValue, query, limitToLast } from 'firebase/database';

export default function Analysis() {
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Listen to current prediction
  useEffect(() => {
    const predRef = ref(database, 'stressPPG/prediction');
    const unsub = onValue(predRef, (snap) => {
      const d = snap.val();
      if (d) {
        setPrediction(d);
        const now = Date.now() / 1000;
        setIsDeviceOnline(d.last_updated && (now - d.last_updated) < 30);
      }
      setLoading(false);
    }, () => { setIsDeviceOnline(false); setLoading(false); });
    return () => unsub();
  }, []);

  // Listen to prediction history (last 50)
  useEffect(() => {
    const histRef = query(ref(database, 'stressPPG/prediction_history'), limitToLast(50));
    const unsub = onValue(histRef, (snap) => {
      const d = snap.val();
      if (d) {
        const entries = Object.entries(d).map(([k, v]) => ({ id: k, ...v }));
        entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setHistory(entries);
      }
      setHistoryLoading(false);
    }, () => setHistoryLoading(false));
    return () => unsub();
  }, []);

  const getStressColor = (st) => {
    if (!st) return '#64748b';
    const sl = st.toLowerCase();
    if (sl.includes('time pressure') || sl.includes('high')) return '#ef4444';
    if (sl.includes('interruption') || sl.includes('elevated')) return '#f59e0b';
    if (sl.includes('normal') || sl.includes('calm')) return '#13ec5b';
    if (sl.includes('low') || sl.includes('relax')) return '#22d3ee';
    if (sl === 'idle') return '#64748b';
    return '#38bdf8';
  };

  const getStressIcon = (st) => {
    if (!st) return 'hourglass-empty';
    const sl = st.toLowerCase();
    if (sl.includes('time pressure') || sl.includes('high')) return 'warning';
    if (sl.includes('interruption')) return 'notifications-active';
    if (sl.includes('normal') || sl.includes('calm')) return 'check-circle';
    if (sl.includes('low') || sl.includes('relax')) return 'sentiment-satisfied';
    if (sl === 'idle') return 'hourglass-empty';
    return 'insights';
  };

  const fmtTime = (ts) => {
    if (!ts) return '--';
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const fmtDate = (ts) => {
    if (!ts) return '--';
    return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const stress = prediction?.stress || 'Waiting...';
  const sc = getStressColor(stress);

  // Distribution counts
  const counts = {};
  history.forEach(i => { const k = i.stress || 'Unknown'; counts[k] = (counts[k] || 0) + 1; });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.hIcon}><MaterialIcons name="insights" size={24} color="#13ec5b" /></View>
          <View>
            <Text style={styles.headerTitle}>Analysis</Text>
            <Text style={styles.headerSub}>PREDICTION HISTORY</Text>
          </View>
        </View>
        <View style={styles.connBadge}>
          <View style={[styles.connDot, { backgroundColor: isDeviceOnline ? '#13ec5b' : '#ef4444' }]} />
          <Text style={styles.connTxt}>{isDeviceOnline ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current prediction */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroCircle, { borderColor: sc }]}>
              <MaterialIcons name={getStressIcon(stress)} size={36} color={sc} />
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroLabel}>CURRENT PREDICTION</Text>
              <Text style={[styles.heroState, { color: sc }]}>{isDeviceOnline ? stress : 'Disconnected'}</Text>
              <Text style={styles.heroSub}>{prediction?.confidence ? `Confidence: ${prediction.confidence}%` : 'Waiting for data...'}</Text>
            </View>
          </View>
          {prediction?.warning && (
            <View style={[styles.warnBox, { borderColor: sc + '30', backgroundColor: sc + '08' }]}>
              <MaterialIcons name={stress.toLowerCase().includes('time pressure') || stress.toLowerCase().includes('interruption') ? 'warning' : 'info-outline'} size={16} color={sc} />
              <Text style={[styles.warnTxt, { color: sc }]}>{prediction.warning}</Text>
            </View>
          )}
        </View>

        {/* Distribution */}
        {history.length > 0 && (
          <View style={styles.distCard}>
            <Text style={styles.secTitle}>STRESS DISTRIBUTION</Text>
            <View style={styles.distGrid}>
              {Object.entries(counts).map(([label, count]) => (
                <View key={label} style={styles.distItem}>
                  <View style={[styles.distDot, { backgroundColor: getStressColor(label) }]} />
                  <Text style={styles.distLabel}>{label}</Text>
                  <Text style={[styles.distCount, { color: getStressColor(label) }]}>{count}</Text>
                </View>
              ))}
            </View>
            <View style={styles.distBar}>
              {Object.entries(counts).map(([label, count]) => (
                <View key={label} style={{ flex: count, height: 6, backgroundColor: getStressColor(label), borderRadius: 3 }} />
              ))}
            </View>
          </View>
        )}

        {/* History */}
        <View style={styles.histHdr}>
          <Text style={styles.secTitle}>PREDICTION HISTORY</Text>
          <Text style={styles.histCount}>{history.length} records</Text>
        </View>

        {historyLoading ? (
          <View style={styles.loadBox}><ActivityIndicator size="large" color="#13ec5b" /><Text style={styles.loadTxt}>Loading from Firebase...</Text></View>
        ) : history.length === 0 ? (
          <View style={styles.emptyBox}><MaterialIcons name="history" size={48} color="#334155" /><Text style={styles.emptyTxt}>No prediction history yet</Text></View>
        ) : (
          <View>
            {history.map((item, idx) => (
              <View key={item.id} style={styles.hItem}>
                <View style={styles.hTimeline}>
                  <View style={[styles.hDot, { backgroundColor: getStressColor(item.stress) }]} />
                  {idx < history.length - 1 && <View style={styles.hLine} />}
                </View>
                <View style={styles.hContent}>
                  <View style={styles.hRow}>
                    <View style={styles.hStressRow}>
                      <MaterialIcons name={getStressIcon(item.stress)} size={14} color={getStressColor(item.stress)} />
                      <Text style={[styles.hStress, { color: getStressColor(item.stress) }]}>{item.stress}</Text>
                    </View>
                    <View style={styles.hTimeBox}>
                      <Text style={styles.hDate}>{fmtDate(item.timestamp)}</Text>
                      <Text style={styles.hTime}>{fmtTime(item.timestamp)}</Text>
                    </View>
                  </View>
                  <Text style={styles.hWarn}>{item.warning}</Text>
                  <View style={styles.hMetrics}>
                    {[
                      `BPM:${item.bpm}`,
                      `RMSSD:${Number(item.rmssd || 0).toFixed(0)}`,
                      `SDNN:${Number(item.sdnn || 0).toFixed(0)}`,
                    ].map(t => (
                      <View key={t} style={styles.hPill}><Text style={styles.hMetric}>{t}</Text></View>
                    ))}
                    {item.confidence && (
                      <View style={[styles.hPill, { backgroundColor: 'rgba(19,236,91,0.1)' }]}>
                        <Text style={[styles.hMetric, { color: '#13ec5b' }]}>{item.confidence}%</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(19,236,91,0.12)', borderWidth: 1, borderColor: 'rgba(19,236,91,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  connBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 40 },
  heroCard: { backgroundColor: '#111813', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  heroCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  heroInfo: { flex: 1 },
  heroLabel: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 4 },
  heroState: { fontSize: 24, fontWeight: 'bold', textTransform: 'capitalize' },
  heroSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  warnTxt: { fontSize: 12, fontWeight: '600', flex: 1 },
  distCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  secTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12 },
  distGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  distItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  distDot: { width: 8, height: 8, borderRadius: 4 },
  distLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  distCount: { fontSize: 13, fontWeight: 'bold' },
  distBar: { flexDirection: 'row', gap: 2, borderRadius: 3, overflow: 'hidden' },
  histHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  histCount: { color: '#475569', fontSize: 11, fontWeight: 'bold' },
  loadBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadTxt: { color: '#64748b', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt: { color: '#64748b', fontSize: 14, fontWeight: 'bold' },
  hItem: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  hTimeline: { alignItems: 'center', width: 20 },
  hDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  hLine: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 4 },
  hContent: { flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  hRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  hStressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hStress: { fontSize: 14, fontWeight: 'bold', textTransform: 'capitalize' },
  hTimeBox: { alignItems: 'flex-end' },
  hDate: { color: '#475569', fontSize: 9, fontWeight: 'bold' },
  hTime: { color: '#64748b', fontSize: 10 },
  hWarn: { color: '#94a3b8', fontSize: 11, marginBottom: 8 },
  hMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hPill: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  hMetric: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' },
});
