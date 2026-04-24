import React from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import Dashboard from './screens/Dashboard';
import DeviceControl from './screens/DeviceControl';
import Analysis from './screens/Analysis';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0a0f0c', // Dark background
            borderTopColor: 'rgba(255,255,255,0.1)',
            height: Platform.OS === 'ios' ? 88 : 60,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#13ec5b',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: 'bold',
            marginTop: -4,
          },
          tabBarIcon: ({ color, size, focused }) => {
            let iconName;

            if (route.name === 'Dashboard') {
              iconName = 'grid-view';
            } else if (route.name === 'Device') {
              iconName = 'developer-board';
            } else if (route.name === 'Analysis') {
              iconName = 'insights';
            }

            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? 'rgba(19, 236, 91, 0.1)' : 'transparent',
                padding: 4,
                borderRadius: 8,
                width: 40,
              }}>
                <MaterialIcons name={iconName} size={24} color={color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen
          name="Device"
          component={DeviceControl}
          options={{ title: 'Control' }}
        />
        <Tab.Screen
          name="Dashboard"
          component={Dashboard}
          options={{ title: 'Dashboard' }}
        />
        <Tab.Screen
          name="Analysis"
          component={Analysis}
          options={{ title: 'Analysis' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
