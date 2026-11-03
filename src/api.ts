import { invoke } from "@tauri-apps/api/core";

export type Mode = "COOL" | "AIR_DRY" | "FAN";
export type WindStrength = "AUTO" | "LOW" | "MID" | "HIGH";
export type TimerKind = "start" | "stop" | "sleep";

export interface Timer {
  hours: number;
  minutes: number;
}

export interface AcStatus {
  name: string;
  model: string;
  power: boolean;
  error: boolean;
  mode: Mode;
  currentTemperature: number | null;
  targetTemperature: number | null;
  minTemperature: number;
  maxTemperature: number;
  windStrength: WindStrength;
  swing: boolean;
  displayLight: boolean;
  startTimer: Timer | null;
  stopTimer: Timer | null;
  sleepTimer: Timer | null;
}

export const api = {
  getStatus: () => invoke<AcStatus>("get_status"),
  setPower: (on: boolean) => invoke<void>("set_power", { on }),
  setMode: (mode: Mode) => invoke<void>("set_mode", { mode }),
  setTargetTemperature: (value: number) => invoke<void>("set_target_temperature", { value }),
  setWindStrength: (strength: WindStrength) => invoke<void>("set_wind_strength", { strength }),
  setSwing: (on: boolean) => invoke<void>("set_swing", { on }),
  setDisplayLight: (on: boolean) => invoke<void>("set_display_light", { on }),
  setTimer: (kind: TimerKind, minutes: number) => invoke<void>("set_timer", { kind, minutes }),
};
