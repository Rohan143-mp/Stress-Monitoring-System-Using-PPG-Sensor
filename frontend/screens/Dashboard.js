import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { API_ENDPOINTS } from '../config';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Defs, LinearGradient, Stop } from 'react-native-svg';

export default function Dashboard() {
  const [data, setData] = useState({
    stress: "Idle",
    warning: "Place finger on sensor",
    bpm: 0,
    hrv: 0,
    spo2: 0,
    respiration: 0
  });
  const [bpmHistory, setBpmHistory] = useState(new Array(20).fill(0));
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.LATEST);
        const json = await response.json();

        setData(prev => {
          if (json.last_updated !== prev.last_updated) {
            // Update BPM history when new data arrives
            if (json.bpm !== undefined) {
              setBpmHistory(h => [...h.slice(1), json.bpm]);
            }
            return json;
          }
          return prev;
        });

        // Heartbeat Logic: Check if data is fresh relative to server time
        const now = json.server_now || (Date.now() / 1000);
        const buffer = (json.send_interval / 1000) + 5;
        if (json.last_updated && (now - json.last_updated) < buffer) {
          setIsDeviceOnline(true);
        } else {
          setIsDeviceOnline(false);
        }
        setLoading(false);
      } catch (error) {
        console.error("Dashboard: Error fetching data:", error);
        setIsDeviceOnline(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const getStressColor = (stress) => {
    if (stress === 'High') return '#ef4444';
    if (stress === 'Low' || stress === 'Normal') return '#13ec5b';
    if (stress === 'Idle' || stress === 'Waiting...') return '#64748b';
    return '#38bdf8';
  };

  const getStressConfidence = () => {
    // Artificial confidence based on sensor data variability
    if (!isDeviceOnline) return "0.0%";
    return "94.2%"; // Placeholder for actual ML confidence if available from server
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.monitoringIcon}>
            <MaterialIcons name="monitor-heart" size={24} color="#13ec5b" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Stress Dashboard</Text>
            <Text style={styles.headerSubtitle}>ESP32 LINKED</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color="#cbd5e1" />
          </TouchableOpacity>
          <View style={styles.avatar} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Connectivity Status */}
        <View style={styles.statusPanel}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, isDeviceOnline ? styles.neonGreen : styles.neonRed]} />
            <Text style={styles.statusText}>HARDWARE: {isDeviceOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.neonBlue]} />
            <Text style={styles.statusText}>WIFI: {loading ? '...' : (isDeviceOnline ? '72MS' : 'NA')}</Text>
          </View>
        </View>

        {/* Real-time BPM */}
        <View style={styles.section}>
          <View style={styles.bpmHeader}>
            <View>
              <Text style={styles.sectionLabel}>Live Heart Rate</Text>
              <View style={styles.bpmValueContainer}>
                <Text style={styles.bpmValue}>{isDeviceOnline ? data.bpm : '--'}</Text>
                <Text style={styles.bpmUnit}>BPM</Text>
              </View>
            </View>
            <View style={styles.trendBadge}>
              <Text style={styles.trendText}>+1.4% vs avg</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <Svg height="100%" width="100%" viewBox="0 0 200 100">
              <Defs>
                <LinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#13ec5b" stopOpacity="0.3" />
                  <Stop offset="100%" stopColor="#13ec5b" stopOpacity="0" />
                </LinearGradient>
              </Defs>

              {/* Reference Grid lines */}
              <Path d="M 0 25 L 200 25" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <Path d="M 0 50 L 200 50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <Path d="M 0 75 L 200 75" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

              {/* Area under the line */}
              <Path
                d={`M 0 100 ${bpmHistory.map((val, i) => `L ${i * (200 / 19)} ${100 - (val / 150) * 80}`).join(' ')} L 200 100 Z`}
                fill="url(#gradient)"
              />

              {/* The Line Graph */}
              <Polyline
                points={bpmHistory.map((val, i) => `${i * (200 / 19)},${100 - (val / 150) * 80}`).join(' ')}
                fill="none"
                stroke="#13ec5b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <View style={styles.timeLabels}>
              <Text style={styles.timeLabel}>History (last 20)</Text>
              <Text style={styles.timeLabel}>Real-time</Text>
            </View>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="favorite" size={20} color="#00f2ff" />
              <View style={styles.metricBadgeBlue}>
                <Text style={styles.metricBadgeTextBlue}>STABLE</Text>
              </View>
            </View>
            <View>
              <Text style={styles.metricLabel}>HRV Status</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>{isDeviceOnline ? data.hrv : '--'}</Text>
                <Text style={styles.metricUnit}>ms</Text>
              </View>
            </View>
          </View>

          <View style={[styles.metricCard, styles.borderLeftGreen]}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="psychology" size={20} color="#13ec5b" />
              <View style={styles.metricBadgeGreen}>
                <Text style={styles.metricBadgeTextGreen}>OPTIMAL</Text>
              </View>
            </View>
            <View>
              <Text style={styles.metricLabel}>Daily Recovery</Text>
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>88</Text>
                <Text style={styles.metricUnit}>%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stress Analysis */}
        <View style={styles.analysisCard}>
          <View style={styles.analysisIconBg}>
            <MaterialIcons name="insights" size={60} color="rgba(255,255,255,0.1)" />
          </View>

          <View style={styles.analysisContent}>
            <Text style={styles.sectionHeader}>ML PREDICTION</Text>
            <View style={styles.analysisRow}>
              <View>
                <Text style={styles.analysisState}>{isDeviceOnline ? data.stress : 'Disconnected'}</Text>
                <Text style={styles.analysisConfidence}>Confidence: {data.stress === 'Idle' ? '0.0%' : getStressConfidence()}</Text>
              </View>
              <View style={styles.gaugeContainer}>
                <View style={[styles.gaugeRing, { borderColor: getStressColor(data.stress) }]} />
                <Text style={styles.gaugeText}>{isDeviceOnline ? data.stress : 'NA'}</Text>
              </View>
            </View>

            <View style={styles.gaugeBarContainer}>
              <View style={styles.gaugeLabels}>
                <Text style={styles.gaugeLabel}>LOW</Text>
                <Text style={styles.gaugeLabel}>MODERATE</Text>
                <Text style={styles.gaugeLabel}>HIGH</Text>
              </View>
              <View style={styles.gaugeBar}>
                <View style={[styles.gaugeSegment, { backgroundColor: data.stress === 'Normal' || data.stress === 'Low' ? '#13ec5b' : '#334155' }]} />
                <View style={[styles.gaugeSegment, { backgroundColor: data.stress === 'Moderate' ? '#f59e0b' : '#334155' }]} />
                <View style={[styles.gaugeSegment, { backgroundColor: data.stress === 'High' ? '#ef4444' : '#334155' }]} />
              </View>
              <Text style={styles.analysisNote}>{isDeviceOnline ? data.warning : 'Sensor data stream is currently inactive.'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.actionButton}>
          <MaterialIcons name="restart-alt" size={24} color="#102216" />
          <Text style={styles.actionButtonText}>Calibrate Sensor</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f0c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 10,
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  monitoringIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(19, 236, 91, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(19, 236, 91, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#334155', // Placeholder color
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  neonGreen: {
    backgroundColor: '#13ec5b',
    shadowColor: '#13ec5b',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  neonBlue: {
    backgroundColor: '#00f2ff',
    shadowColor: '#00f2ff',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  neonRed: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  statusText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  section: {
    marginBottom: 24,
  },
  bpmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  bpmValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  bpmValue: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  bpmUnit: {
    color: '#13ec5b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  trendBadge: {
    backgroundColor: 'rgba(19, 236, 91, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    color: '#13ec5b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chartContainer: {
    height: 192,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'space-between',
  },
  chartPlaceholder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  chartBar: {
    width: 4,
    backgroundColor: '#13ec5b',
    borderRadius: 2,
    opacity: 0.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  borderLeftGreen: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(19, 236, 91, 0.4)',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricBadgeBlue: {
    backgroundColor: 'rgba(0, 242, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metricBadgeTextBlue: {
    color: '#00f2ff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  metricBadgeGreen: {
    backgroundColor: 'rgba(19, 236, 91, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metricBadgeTextGreen: {
    color: '#13ec5b',
    fontSize: 8,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  metricUnit: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  analysisCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  analysisIconBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 16,
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  analysisState: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  analysisConfidence: {
    color: '#13ec5b',
    fontSize: 12,
    fontWeight: '500',
  },
  gaugeContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#13ec5b', // Simplified ring
    // To do partial ring would require SVG
  },
  gaugeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gaugeBarContainer: {
    gap: 8,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gaugeLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gaugeBar: {
    height: 8,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeSegment: {
    flex: 1,
  },
  analysisNote: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#13ec5b',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  actionButtonText: {
    color: '#0a0f0c',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
