import { invoke } from "@tauri-apps/api/core";

// Modos e velocidades vêm do profile de cada modelo (ex.: "COOL", "HEAT", "AUTO", "LOW").
export type TimerKind = "start" | "stop" | "sleep";

export interface Timer {
  hours: number;
  minutes: number;
}

export interface Capabilities {
  power: boolean;
  modes: string[];
  windStrengths: string[];
  minTemperature: number;
  maxTemperature: number;
  temperatureStep: number;
  swing: boolean;
  displayLight: boolean;
  startTimer: boolean;
  stopTimer: boolean;
  sleepTimer: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  capabilities: Capabilities;
}

export interface DeviceSummary {
  id: string;
  name: string;
  model: string;
  deviceType: string;
  selected: boolean;
}

export interface AcStatus {
  device: DeviceInfo;
  power: boolean;
  error: boolean;
  mode: string;
  currentTemperature: number | null;
  targetTemperature: number | null;
  windStrength: string | null;
  swing: boolean;
  displayLight: boolean;
  startTimer: Timer | null;
  stopTimer: Timer | null;
  sleepTimer: Timer | null;
}

export const api = {
  getStatus: () => invoke<AcStatus>("get_status"),
  listDevices: () => invoke<DeviceSummary[]>("list_devices"),
  setPower: (on: boolean) => invoke<void>("set_power", { on }),
  setMode: (mode: string) => invoke<void>("set_mode", { mode }),
  setTargetTemperature: (value: number, mode: string) => invoke<void>("set_target_temperature", { value, mode }),
  setWindStrength: (strength: string) => invoke<void>("set_wind_strength", { strength }),
  setSwing: (on: boolean) => invoke<void>("set_swing", { on }),
  setDisplayLight: (on: boolean) => invoke<void>("set_display_light", { on }),
  setTimer: (kind: TimerKind, minutes: number) => invoke<void>("set_timer", { kind, minutes }),
};
