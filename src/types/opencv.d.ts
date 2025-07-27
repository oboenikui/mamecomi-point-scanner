// OpenCV.js type definitions for mamecomi-point-scanner
declare global {
  interface Window {
    cv: any;
    Module: {
      onRuntimeInitialized: () => void;
    };
  }
}

export interface Mat {
  delete(): void;
  rows: number;
  cols: number;
  data: Uint8Array;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoCapture {
  read(frame: Mat): boolean;
  release(): void;
}

// Basic OpenCV functions that we'll use
export interface OpenCV {
  Mat: new () => Mat;
  VideoCapture: new (source: number | HTMLVideoElement) => VideoCapture;
  imread: (source: string | HTMLImageElement | HTMLCanvasElement) => Mat;
  imshow: (canvasId: string, mat: Mat) => void;
  cvtColor: (src: Mat, dst: Mat, code: number) => void;
  threshold: (src: Mat, dst: Mat, thresh: number, maxval: number, type: number) => void;
  findContours: (image: Mat, contours: any, hierarchy: Mat, mode: number, method: number) => void;
  boundingRect: (contour: any) => Rect;
  // Color conversion codes
  COLOR_RGBA2GRAY: number;
  COLOR_RGB2GRAY: number;
  // Threshold types
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  // Contour retrieval modes
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  // Contour approximation methods
  CHAIN_APPROX_SIMPLE: number;
  CHAIN_APPROX_NONE: number;
}

export {}; 