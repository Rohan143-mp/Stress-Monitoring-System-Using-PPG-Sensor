import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Analysis({ navigation }) {
  const [data, setData] = useState({
    stress: "Waiting...",
    warning: "Ensure device is connected",
    bpm: 0,
    hrv: 0,
    spo2: 0,
    respiration: 0
  });
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://10.115.15.118:5000/latest');
        const json = await response.json();

        setData(prev => {
          if (json.last_updated !== prev.last_updated) {
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
        console.error("Analysis: Error fetching data:", error);
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

  const getAnalysisIcon = () => {
    if (!isDeviceOnline) return "cloud-off";
    if (data.stress === "High") return "warning";
    if (data.stress === "Normal" || data.stress === "Low") return "check-circle";
    return "insights";
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios" size={20} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stress Analysis</Text>
        <TouchableOpacity style={styles.syncBtn}>
          <MaterialIcons name="sync" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroRingContainer}>
            <View style={styles.heroRingOuter} />
            <View style={[styles.heroRingSpinner, { borderColor: isDeviceOnline ? getStressColor(data.stress) : '#64748b' }]} />
            <View style={[styles.heroIconBg, { backgroundColor: isDeviceOnline ? (data.stress === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(19, 236, 91, 0.1)') : 'rgba(255,255,255,0.05)' }]}>
              <MaterialIcons name={getAnalysisIcon()} size={48} color={isDeviceOnline ? getStressColor(data.stress) : '#64748b'} />
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {isDeviceOnline ? (data.stress === 'Idle' ? 'System Idle' : `${data.stress} Stress`) : 'Waiting for Data'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isDeviceOnline ? (data.stress === 'Idle' ? 'Place finger on sensor to begin' : 'ML Model: Flask API v2.4 • Active Now') : 'Connect ESP32 sensor for live analysis'}
          </Text>
        </View>

        {/* Key Factors Grid */}
        <View style={styles.grid}>
          <View style={styles.factorCard}>
            <Text style={styles.factorLabel}>HRV</Text>
            <Text style={styles.factorValue}>{isDeviceOnline ? `${data.hrv} ms` : '--'}</Text>
            <View style={[styles.trendBadge, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
              <MaterialIcons name={data.hrv < 50 ? "trending-down" : "trending-up"} size={14} color={data.hrv < 50 ? "#ef4444" : "#13ec5b"} />
              <Text style={{ color: data.hrv < 50 ? "#ef4444" : "#13ec5b", fontSize: 10, fontWeight: 'bold' }}>{isDeviceOnline ? (data.hrv < 50 ? 'LOW' : 'GOOD') : '--'}</Text>
            </View>
          </View>

          <View style={styles.factorCard}>
            <Text style={styles.factorLabel}>Respiration</Text>
            <Text style={styles.factorValue}>{isDeviceOnline ? data.respiration : '--'}</Text>
            <View style={[styles.trendBadge, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
              <MaterialIcons name="air" size={14} color="#38bdf8" />
              <Text style={{ color: '#38bdf8', fontSize: 10, fontWeight: 'bold' }}>RPM</Text>
            </View>
          </View>

          <View style={styles.factorCard}>
            <Text style={styles.factorLabel}>SpO2</Text>
            <Text style={styles.factorValue}>{isDeviceOnline ? `${data.spo2}%` : '--'}</Text>
            <Text style={styles.factorStatus}>{isDeviceOnline && data.spo2 > 95 ? 'OPTIMAL' : (isDeviceOnline ? 'CHECK' : '--')}</Text>
          </View>
        </View>

        {/* Confidence Score */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>ML Confidence Score</Text>
            <Text style={styles.confidenceScore}>{isDeviceOnline ? '94.2%' : '0.0%'}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: isDeviceOnline ? '94%' : '0%', backgroundColor: getStressColor(data.stress) }]} />
          </View>
          <Text style={styles.cardFooter}>
            {isDeviceOnline
              ? `The ML model predicts a "${data.stress}" state based on your biometric rhythm and HRV variability.`
              : 'ML inference is paused until live sensor data is received from the device.'}
          </Text>
        </View>

        {/* Recommendation */}
        <View style={styles.recommendationCard}>
          <View style={styles.recRow}>
            <View style={styles.recIconBg}>
              <MaterialIcons name="spa" size={24} color="#102216" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recTitle}>Recommendation</Text>
              <Text style={styles.recText}>
                System suggests activating <Text style={{ color: '#13ec5b', fontWeight: 'bold', fontStyle: 'italic' }}>Relax Mode</Text>. We will adjust your environment lighting and trigger a 5-minute guided breathing session on your ESP32 device.
              </Text>
              <TouchableOpacity style={styles.activateBtn}>
                <MaterialIcons name="power-settings-new" size={20} color="#102216" />
                <Text style={styles.activateBtnText}>Activate Relax Mode</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ESP32 Status */}
        <View style={styles.espStatusCard}>
          <View style={styles.espRow}>
            <View>
              <MaterialIcons name="memory" size={24} color="#64748b" />
              {/* Online dot */}
              <View style={[styles.onlineDot, { backgroundColor: isDeviceOnline ? '#13ec5b' : '#ef4444' }]} />
            </View>
            <View>
              <Text style={styles.espName}>ESP32-NODE-01</Text>
              <Text style={[styles.espConnected, { color: isDeviceOnline ? '#13ec5b' : '#ef4444' }]}>
                {isDeviceOnline ? 'CONNECTED' : 'DISCONNECTED'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('DeviceControl')}
          >
            <Text style={styles.manageBtnText}>Manage</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#102216', // consistent dark bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#102216',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  syncBtn: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  heroRingContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  heroRingOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: 'rgba(19, 236, 91, 0.2)',
  },
  heroRingSpinner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderTopWidth: 4,
    borderColor: '#f97316',
    transform: [{ rotate: '45deg' }], // Static rotation for simplified visual
  },
  heroIconBg: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#9db9a6',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  factorCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  factorLabel: {
    color: '#9db9a6',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  factorValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  factorStatus: {
    color: '#64748b',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#1a2e20',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confidenceScore: {
    color: '#13ec5b',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#111813',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#13ec5b',
    borderRadius: 6,
  },
  cardFooter: {
    color: '#9db9a6',
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
  recommendationCard: {
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: 'rgba(19, 236, 91, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(19, 236, 91, 0.3)',
    marginBottom: 16,
  },
  recRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  recIconBg: {
    backgroundColor: '#13ec5b',
    padding: 8,
    borderRadius: 8,
  },
  recTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recText: {
    color: '#9db9a6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  activateBtn: {
    backgroundColor: '#13ec5b',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activateBtnText: {
    color: '#102216',
    fontWeight: 'bold',
  },
  espStatusCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  espRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    backgroundColor: '#13ec5b',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#102216',
  },
  espName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  espConnected: {
    color: '#13ec5b',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  manageBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  manageBtnText: {
    color: '#9db9a6',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
