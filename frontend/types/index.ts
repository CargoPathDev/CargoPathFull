export interface User {
  id: string;
  email: string;
  name: string;
  subscription_tier: 'free' | 'basic' | 'premium' | 'corporate';
  role?: 'user' | 'admin';
  is_trial?: boolean;
  trial_days_remaining?: number;
  is_gifted?: boolean;
  is_corporate_admin?: boolean;
  corporate_id?: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  name: string;
  vehicle_type: string;
  height_meters: number;
  width_meters: number;
  weight_kg: number;
  license_plate?: string;
  is_active: boolean;
  created_at: string;
}

export interface RoadAlert {
  id: string;
  alert_type: 'speed_camera' | 'roadwork' | 'hazard' | 'school_zone' | 'bump' | 'traffic_light' | 'police_visible' | 'police_hidden' | 'police_trap' | 'police_checkpoint' | 'object_on_road' | 'accident' | 'traffic_jam';
  latitude: number;
  longitude: number;
  description?: string;
  speed_limit?: number;
  time_restriction_start?: string;
  time_restriction_end?: string;
  diversion_info?: string;
  estimated_end_date?: string;
  created_by: string;
  created_at: string;
  upvotes: number;
  is_active: boolean;
}

export interface RoadRestriction {
  id: string;
  restriction_type: 'height' | 'weight' | 'width';
  latitude: number;
  longitude: number;
  limit_value: number;
  description?: string;
  is_active: boolean;
}

export interface RoadWork {
  id: string;
  work_type: 'road_closure' | 'lane_closure' | 'temp_traffic_lights' | 'resurfacing' | 'utilities' | 'construction';
  latitude: number;
  longitude: number;
  end_latitude?: number;
  end_longitude?: number;
  description: string;
  company_name: string;
  start_date: string;
  estimated_end_date: string;
  diversion_route?: string;
  affected_lanes?: string;
  working_hours?: string;
  contact_phone?: string;
  status: 'pending' | 'approved' | 'active' | 'completed';
  created_by: string;
  created_at: string;
  verified: boolean;
}

export interface Subscription {
  tier: 'free' | 'basic' | 'premium' | 'corporate';
  vehicle_count: number;
  vehicle_limit: number;
  features: string[];
}

export type VehicleType = 'car' | 'van' | 'lorry' | 'bus' | 'motorcycle' | 'other';

export interface UserPoints {
  total_points: number;
  lifetime_points: number;
  level: number;
  streak_days: number;
  next_level_points: number;
}

export interface Reward {
  id: string;
  name: string;
  type: 'avatar' | 'voice' | 'badge';
  cost: number;
  icon?: string;
  color?: string;
  voice_id?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  dark_mode_start: string;
  dark_mode_end: string;
  voice_id: string;
  sound_mode: 'off' | 'alerts' | 'full';
  speed_unit: 'mph' | 'kmh';
  distance_unit: 'miles' | 'km';
  safety_reminder_enabled: boolean;
  avatar_id: string;
  home_address?: {
    address: string;
    lat: number;
    lng: number;
  };
  work_address?: {
    address: string;
    lat: number;
    lng: number;
  };
}

export interface CorporateAccount {
  id: string;
  company_name: string;
  admin_email: string;
  max_vehicles: number;
  safety_mode_enabled: boolean;
  employee_count: number;
  vehicle_count: number;
  is_admin: boolean;
}

export interface Employee {
  id: string;
  email: string;
  name: string;
  assigned_vehicle_id?: string;
}
