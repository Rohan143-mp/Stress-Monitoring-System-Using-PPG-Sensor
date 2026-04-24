import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { database } from '../firebaseConfig';
import { ref, onValue } from 'firebase/database';

const CHART_POINTS = 25;

export default function Dashboard() {
  const [prediction, setPrediction] = useState(null);
  const [bpmHistory, setBpmHistory] = useState(new Array(CHART_POINTS).fill(0));
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const heartAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const hb = Animated.loop(Animated.sequence([
      Animated.timing(heartAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1.15, duration: 180, useNativeDriver: true }),
      Animated.timing(heartAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]));
    hb.start();
    return () => hb.stop();
  }, []);

  useEffect(() => {
    const predRef = ref(database, 'stressPPG/prediction');
    const unsub = onValue(predRef, (snap) => {
      const d = snap.val();
      if (d) {
        setPrediction(d);
        const currentBpm = d.bpm || 0;
        if (currentBpm > 0) {
          setBpmHistory(prev => {
            if (currentBpm !== prev[prev.length - 1]) return [...prev.slice(1), currentBpm];
            return prev;
          });
        }
        const now = Date.now() / 1000;
        setIsDeviceOnline(d.last_updated && (now - d.last_updated) < 30);
      }
      setLoading(false);
    }, () => { setIsDeviceOnline(false); setLoading(false); });
    return () => unsub();
  }, []);

  const bpm = prediction?.bpm || 0;
  const stress = prediction?.stress || 'Idle';
  const warning = prediction?.warning || 'Place finger on sensor';
  const confidence = prediction?.confidence;
  const hrv = prediction?.hrv || 0;
  const spo2 = prediction?.spo2 || 0;

  const getStressColor = (s) => {
    if (!s) return '#64748b';
    const sl = s.toLowerCase();
    if (sl.includes('time pressure') || sl.includes('high')) return '#ef4444';
    if (sl.includes('interruption') || sl.includes('elevated')) return '#f59e0b';
    if (sl.includes('normal') || sl.includes('calm')) return '#13ec5b';
    if (sl.includes('low') || sl.includes('relax')) return '#22d3ee';
    if (sl === 'idle') return '#64748b';
    return '#38bdf8';
  };

  const cW = 280, cH = 120, pad = 10;
  const valid = bpmHistory.filter(v => v > 0);
  const mx = valid.length > 0 ? Math.max(...valid, 100) : 150;
  const mn = valid.length > 0 ? Math.min(...valid, 60) : 40;
  const rng = Math.max(mx - mn, 40);
  const gY = (v) => v === 0 ? cH - pad : cH - pad - ((v - mn + 10) / (rng + 20)) * (cH - 2 * pad);

  const pts = bpmHistory.map((v, i) => `${pad + (i / (CHART_POINTS - 1)) * (cW - 2 * pad)},${gY(v)}`).join(' ');
  const area = `M ${pad} ${cH - pad} ${bpmHistory.map((v, i) => `L ${pad + (i / (CHART_POINTS - 1)) * (cW - 2 * pad)} ${gY(v)}`).join(' ')} L ${cW - pad} ${cH - pad} Z`;
  const lx = cW - pad, ly = gY(bpmHistory[CHART_POINTS - 1]);
  const sc = getStressColor(stress);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.monIcon}><MaterialIcons name="dashboard" size={24} color="#13ec5b" /></View>
          <View>
            <Text style={s.headerTitle}>Dashboard</Text>
            <Text style={s.headerSub}>REAL-TIME</Text>
          </View>
        </View>
        <View style={[s.liveInd, isDeviceOnline && s.liveIndAct]}>
          <View style={[s.liveDot, { backgroundColor: isDeviceOnline ? '#ef4444' : '#64748b' }]} />
          <Text style={s.liveTxt}>{isDeviceOnline ? 'LIVE' : 'IDLE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.chartCard}>
          <View style={s.chartHdr}>
            <View>
              <Text style={s.chartLbl}>Live Heart Rate</Text>
              <View style={s.bpmRow}>
                <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
                  <MaterialIcons name="favorite" size={28} color="#ef4444" />
                </Animated.View>
                <Text style={s.bpmLg}>{isDeviceOnline && bpm > 0 ? bpm : '--'}</Text>
                <Text style={s.bpmUn}>BPM</Text>
              </View>
            </View>
            <View style={s.bpmStats}>
              {[
                { l: 'MAX', v: valid.length > 0 ? Math.max(...valid) : '--' },
                { l: 'MIN', v: valid.length > 0 ? Math.min(...valid) : '--' },
                { l: 'AVG', v: valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b) / valid.length) : '--' },
              ].map(x => (
                <View key={x.l} style={s.bpmStatItem}>
                  <Text style={s.bpmStatLbl}>{x.l}</Text>
                  <Text style={s.bpmStatVal}>{x.v}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.chartCont}>
            <Svg height={cH} width="100%" viewBox={`0 0 ${cW} ${cH}`}>
              <Defs>
                <LinearGradient id="hg" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                  <Stop offset="50%" stopColor="#ef4444" stopOpacity="0.08" />
                  <Stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                  <Stop offset="70%" stopColor="#ef4444" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                </LinearGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((p, i) => (
                <Line key={i} x1={pad} y1={cH * p} x2={cW - pad} y2={cH * p} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              ))}
              <Path d={area} fill="url(#hg)" />
              <Polyline points={pts} fill="none" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {bpmHistory[CHART_POINTS - 1] > 0 && (<>
                <Circle cx={lx} cy={ly} r="6" fill="rgba(239,68,68,0.2)" />
                <Circle cx={lx} cy={ly} r="3.5" fill="#ef4444" />
              </>)}
            </Svg>
          </View>
          <View style={s.timeLbls}>
            <Text style={s.timeLbl}>← older</Text>
            <Text style={s.timeLbl}>now →</Text>
          </View>
        </View>

        <View style={[s.predCard, { borderLeftColor: sc }]}>
          <View style={s.predHdr}>
            <View style={s.predBadge}>
              <MaterialIcons name="psychology" size={16} color="#0a0f0c" />
              <Text style={s.predBadgeTxt}>ML PREDICTION</Text>
            </View>
            {confidence && <Text style={[s.predConf, { color: sc }]}>{confidence}%</Text>}
          </View>
          <View style={s.predBody}>
            <Text style={[s.predState, { color: sc }]}>{isDeviceOnline ? stress : 'Waiting for sensor'}</Text>
            <Text style={s.predWarn}>{warning}</Text>
          </View>
          <View style={s.stressBarTrack}>
            <View style={[s.stressBarFill, { width: confidence ? `${confidence}%` : '0%', backgroundColor: sc }]} />
          </View>
        </View>

        <Text style={s.secTitle}>SENSOR DATA</Text>
        <View style={s.mGrid}>
          <View style={[s.mCard, { borderTopColor: '#38bdf8' }]}>
            <MaterialIcons name="graphic-eq" size={22} color="#38bdf8" />
            <Text style={s.mLbl}>HRV</Text>
            <Text style={[s.mVal, { color: '#38bdf8' }]}>{isDeviceOnline ? Number(hrv).toFixed(1) : '--'}</Text>
            <Text style={s.mUn}>ms</Text>
          </View>
          <View style={[s.mCard, { borderTopColor: '#ec4899' }]}>
            <MaterialIcons name="water-drop" size={22} color="#ec4899" />
            <Text style={s.mLbl}>SpO2</Text>
            <Text style={[s.mVal, { color: '#ec4899' }]}>{isDeviceOnline ? spo2 : '--'}</Text>
            <Text style={s.mUn}>%</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, paddingTop: 10, alignItems: 'center' },
  headerLeft: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  monIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(19,236,91,0.12)', borderWidth: 1, borderColor: 'rgba(19,236,91,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
  liveInd: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  liveIndAct: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  chartHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  chartLbl: { color: '#64748b', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  bpmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpmLg: { color: 'white', fontSize: 44, fontWeight: 'bold', letterSpacing: -1 },
  bpmUn: { color: '#ef4444', fontSize: 16, fontWeight: 'bold', marginTop: 14 },
  bpmStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  bpmStatItem: { alignItems: 'center' },
  bpmStatLbl: { color: '#475569', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  bpmStatVal: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 'bold', marginTop: 2 },
  chartCont: { height: 120, marginBottom: 8 },
  timeLbls: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLbl: { color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  predCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderLeftWidth: 4 },
  predHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  predBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#13ec5b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  predBadgeTxt: { color: '#0a0f0c', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  predConf: { fontSize: 22, fontWeight: 'bold' },
  predBody: { marginBottom: 14 },
  predState: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, textTransform: 'capitalize' },
  predWarn: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  stressBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  stressBarFill: { height: '100%', borderRadius: 3 },
  secTitle: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 12 },
  mGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  mCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderTopWidth: 3, gap: 4 },
  mLbl: { color: '#64748b', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 4 },
  mVal: { fontSize: 24, fontWeight: 'bold' },
  mUn: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 'bold' },
});
