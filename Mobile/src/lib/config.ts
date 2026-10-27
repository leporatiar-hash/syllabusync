import Constants from 'expo-constants';

// Set per build profile in eas.json (production points at Railway); .env for local dev.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// RevenueCat public iOS SDK key (appl_...). Safe to ship in the app. Empty = purchases disabled.
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';

// The RevenueCat entitlement that unlocks Pro. Must match the dashboard.
export const PRO_ENTITLEMENT = 'classmate_pro';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export const WEB_URL = 'https://www.tryclassmate.com';
