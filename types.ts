import { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface HandStatus {
  isDetected: boolean;
  isPinching: boolean;
  position: { x: number; y: number }; // Normalized 0-1
  pinchDistance: number;
}

export interface SharedHandState {
  left: HandStatus;  // Controls Earth
  right: HandStatus; // Controls Panel
  landmarks: {
    left: NormalizedLandmark[] | null;
    right: NormalizedLandmark[] | null;
  }
}

export enum Continent {
  Unknown = "未知区域",
  Asia = "亚洲战区",
  Europe = "欧洲联盟",
  Africa = "非洲资源区",
  Americas = "美洲防线",
  Pacific = "太平洋公海"
}