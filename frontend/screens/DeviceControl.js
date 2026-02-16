import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { API_ENDPOINTS } from '../config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

export default function DeviceControl() {
  const [data, setData] = useState({
    stress: "Waiting...",
    warning: "Ensure device is connected",
    bpm: 0,
    hrv: 0,
    spo2: 0,
    respiration: 0
  });
  const [loading, setLoading] = useState(true);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [isSensorActive, setIsSensorActive] = useState(true);
  const [displayMode, setDisplayMode] = useState('STRESS');
  const [updateInterval, setUpdateInterval] = useState(2000);

  const setDeviceDisplayMode = async (mode) => {
    try {
      await fetch(API_ENDPOINTS.DISPLAY_MODE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });
      setDisplayMode(mode);
    } catch (error) {
      console.error("Error setting display mode:", error);
    }
  };

  const setSensorControl = async (active) => {
    try {
      await fetch(API_ENDPOINTS.SENSOR_CONTROL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active }),
      });
      setIsSensorActive(active);
    } catch (error) {
      console.error("Error setting sensor control:", error);
    }
  };

  const updateServerInterval = async (interval) => {
    try {
      await fetch(API_ENDPOINTS.SET_INTERVAL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interval }),
      });
      setUpdateInterval(interval);
    } catch (error) {
      console.error("Error setting interval:", error);
    }
  };

  const recalibrateSensors = async () => {
    try {
      await fetch(API_ENDPOINTS.RECALIBRATE, {
        method: 'POST',
      });
      alert("Recalibration command sent to device!");
    } catch (error) {
      console.error("Error recalibrating:", error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.LATEST);
        const json = await response.json();

        setData(prev => {
          if (json.last_updated !== prev.last_updated) {
            return json;
          }
          return prev;
        });

        if (json.display_mode) setDisplayMode(json.display_mode);
        if (json.hasOwnProperty('is_sensor_active')) setIsSensorActive(json.is_sensor_active);
        if (json.send_interval) setUpdateInterval(json.send_interval);

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
        console.error("Error fetching data:", error);
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
    return '#38bdf8';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBg}>
            <MaterialIcons name="settings-remote" size={24} color="#13ec5b" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Device Control</Text>
            <Text style={styles.headerSubtitle}>ESP32 LINKED</Text>
          </View>
        </View>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isDeviceOnline ? '#13ec5b' : '#ef4444' }]} />
          <Text style={styles.statusText}>{isDeviceOnline ? 'DEVICE: ONLINE' : 'DEVICE: OFFLINE'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* OLED Display Control */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>OLED DISPLAY MODE</Text>
        </View>

        <View style={styles.modeGrid}>
          <TouchableOpacity
            style={[styles.modeButton, displayMode === 'STRESS' && styles.modeButtonActive]}
            onPress={() => setDeviceDisplayMode('STRESS')}
          >
            <MaterialIcons name="sentiment-satisfied" size={24} color={displayMode === 'STRESS' ? '#0a0f0c' : 'white'} />
            <Text style={[styles.modeButtonText, displayMode === 'STRESS' && styles.modeButtonTextActive]}>Stress</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, displayMode === 'BPM' && styles.modeButtonActive]}
            onPress={() => setDeviceDisplayMode('BPM')}
          >
            <MaterialIcons name="favorite" size={24} color={displayMode === 'BPM' ? '#0a0f0c' : 'white'} />
            <Text style={[styles.modeButtonText, displayMode === 'BPM' && styles.modeButtonTextActive]}>Heart Rate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, displayMode === 'SPO2' && styles.modeButtonActive]}
            onPress={() => setDeviceDisplayMode('SPO2')}
          >
            <MaterialIcons name="water-drop" size={24} color={displayMode === 'SPO2' ? '#0a0f0c' : 'white'} />
            <Text style={[styles.modeButtonText, displayMode === 'SPO2' && styles.modeButtonTextActive]}>SpO2</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, displayMode === 'IDLE' && styles.modeButtonActive]}
            onPress={() => setDeviceDisplayMode('IDLE')}
          >
            <MaterialIcons name="access-time" size={24} color={displayMode === 'IDLE' ? '#0a0f0c' : 'white'} />
            <Text style={[styles.modeButtonText, displayMode === 'IDLE' && styles.modeButtonTextActive]}>Clock</Text>
          </TouchableOpacity>
        </View>

        {/* Main Stress Card */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Live Stress Analysis</Text>
            <MaterialIcons name="analytics" size={20} color="rgba(255,255,255,0.5)" />
          </View>

          <View style={styles.stressContainer}>
            <Text style={[styles.stressValue, { color: getStressColor(data.stress) }]}>
              {loading ? '...' : data.stress}
            </Text>
            <Text style={styles.stressLabel}>Current State</Text>
          </View>

          <View style={styles.warningContainer}>
            <MaterialIcons name="info-outline" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.warningText}>{data.warning}</Text>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.grid}>
          {/* BPM */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="favorite" size={20} color="#ef4444" />
              <Text style={styles.metricLabel}>HEART RATE</Text>
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricValue}>{data.bpm}</Text>
              <Text style={styles.metricUnit}>BPM</Text>
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricTrend}>Normal Range</Text>
            </View>
          </View>

          {/* HRV */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="graphic-eq" size={20} color="#38bdf8" />
              <Text style={styles.metricLabel}>HRV</Text>
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricValue}>{data.hrv}</Text>
              <Text style={styles.metricUnit}>ms</Text>
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricTrend}> Variability</Text>
            </View>
          </View>

          {/* SpO2 */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="water-drop" size={20} color="#06b6d4" />
              <Text style={styles.metricLabel}>SpO2</Text>
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricValue}>{data.spo2}</Text>
              <Text style={styles.metricUnit}>%</Text>
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricTrend}>Oxygen Level</Text>
            </View>
          </View>

          {/* Respiration */}
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <FontAwesome5 name="lungs" size={16} color="#13ec5b" />
              <Text style={styles.metricLabel}>RESP</Text>
            </View>
            <View style={styles.metricContent}>
              <Text style={styles.metricValue}>{data.respiration}</Text>
              <Text style={styles.metricUnit}>rpm</Text>
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricTrend}>Breathing Rate</Text>
            </View>
          </View>
        </View>

        {/* Manual Controls */}
        <Text style={styles.sectionHeader}>MANUAL CONTROLS</Text>

        <TouchableOpacity
          style={[styles.actionButton, !isSensorActive && { backgroundColor: '#38bdf8' }]}
          onPress={() => setSensorControl(!isSensorActive)}
        >
          <View style={styles.actionIcon}>
            <MaterialIcons name={isSensorActive ? "pause" : "play-arrow"} size={24} color="#102216" />
          </View>
          <Text style={styles.actionText}>{isSensorActive ? 'Stop Monitoring' : 'Start Monitoring'}</Text>
        </TouchableOpacity>

        {/* Frequency Control */}
        <Text style={styles.sectionHeader}>UPDATE FREQUENCY</Text>
        <View style={styles.intervalGrid}>
          {[10000, 20000, 30000].map((val) => (
            <TouchableOpacity
              key={val}
              style={[styles.intervalBtn, updateInterval === val && styles.activeIntervalBtn]}
              onPress={() => updateServerInterval(val)}
            >
              <Text style={[styles.intervalText, updateInterval === val && styles.activeIntervalText]}>
                {val / 1000}s
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={recalibrateSensors}>
          <View style={styles.actionIcon}>
            <MaterialIcons name="refresh" size={24} color="#102216" />
          </View>
          <Text style={styles.actionText}>Recalibrate Sensors</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
          <View style={[styles.actionIcon, styles.secondaryIcon]}>
            <MaterialIcons name="bluetooth-searching" size={24} color="white" />
          </View>
          <Text style={[styles.actionText, styles.secondaryText]}>Reconnect Device</Text>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(19, 236, 91, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(19, 236, 91, 0.2)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    padding: 24,
  },
  mainCard: {
    backgroundColor: '#111813', // Slightly lighter than bg
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  cardTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stressValue: {
    fontSize: 42,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  stressLabel: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
  },
  warningText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  metricCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  metricContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  metricValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 8,
    marginTop: 4,
  },
  metricTrend: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#13ec5b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#0a0f0c',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryIcon: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  secondaryText: {
    color: 'white',
  },
  sectionHeaderContainer: {
    marginTop: 0,
    marginBottom: 16,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  modeButton: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modeButtonActive: {
    backgroundColor: '#13ec5b',
    borderColor: '#13ec5b',
  },
  modeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modeButtonTextActive: {
    color: '#0a0f0c',
  },
  intervalGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  intervalBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeIntervalBtn: {
    backgroundColor: '#13ec5b',
    borderColor: '#13ec5b',
  },
  intervalText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeIntervalText: {
    color: '#0a0f0c',
  }
});
