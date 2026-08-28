"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Retail barcode formats only (PRD §4: "EAN/UPC/Code 128 and more") — not
// QR codes, which would also decode but aren't what a packaged-food label
// ever uses.
const BARCODE_FORMATS = [9, 10, 5, 14, 15]; // html5-qrcode enum: EAN_13, EAN_8, CODE_128, UPC_A, UPC_E
const NATIVE_FORMATS = ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"];

const CAMERA_ELEMENT_ID = "calorie-barcode-camera";
const FILE_ELEMENT_ID = "calorie-barcode-file";

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function hasNativeDetector(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector !== "undefined";
}

// Wide and short, not square — a retail barcode is a horizontal strip, and
// a square/near-square box (the html5-qrcode default, tuned for QR codes)
// crops off the ends of the barcode before it can be read. Only used by
// the html5-qrcode fallback path.
function qrbox(viewfinderWidth: number, viewfinderHeight: number) {
  const width = Math.floor(Math.min(viewfinderWidth * 0.85, 350));
  const height = Math.min(viewfinderHeight - 20, Math.max(80, Math.floor(width * 0.35)));
  return { width, height };
}

export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopNativeCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    return () => {
      stopNativeCamera();
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear());
      }
    };
  }, []);

  // Camera permission is only requested once this is actually called —
  // i.e. only after the user presses "Scan with camera" (PRD §7). Prefers
  // the browser's native BarcodeDetector (hardware-backed on most Android/
  // Chrome devices, far more reliable on real-world 1D barcodes than a JS
  // decoder) and only falls back to html5-qrcode's bundled zxing decoder
  // on browsers that don't support it (Safari, some desktop browsers).
  async function startCamera() {
    setCameraError(null);
    setCameraActive(true);

    if (hasNativeDetector()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        if (!videoRef.current) throw new Error("Video element not ready");
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });

        const tick = async () => {
          if (!videoRef.current || detectingRef.current) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          detectingRef.current = true;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              onCode(results[0].rawValue);
              stopNativeCamera();
              setCameraActive(false);
              return;
            }
          } catch {
            // Transient per-frame decode errors are expected and ignored — keep scanning.
          }
          detectingRef.current = false;
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return;
      } catch (error) {
        stopNativeCamera();
        setCameraError(error instanceof Error ? error.message : "Couldn't access the camera — try image upload or manual entry instead.");
        setCameraActive(false);
        return;
      }
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox },
        (decodedText) => {
          onCode(decodedText);
          scanner
            .stop()
            .catch(() => {})
            .finally(() => scanner.clear());
          setCameraActive(false);
        },
        undefined
      );
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Couldn't access the camera — try image upload or manual entry instead.");
      setCameraActive(false);
    }
  }

  async function stopCamera() {
    stopNativeCamera();
    const scanner = scannerRef.current;
    if (scanner) {
      await scanner.stop().catch(() => {});
      scanner.clear();
    }
    setCameraActive(false);
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;

    if (hasNativeDetector()) {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });
        const results = await detector.detect(bitmap);
        if (results.length === 0) throw new Error("No barcode found in image");
        onCode(results[0].rawValue);
      } catch (error) {
        setCameraError(
          `Couldn't read a barcode from that image — try a clearer, closer, well-lit photo, or enter the code manually.${
            error instanceof Error ? ` (${error.message})` : ""
          }`
        );
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(FILE_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      const decoded = await scanner.scanFile(file, false);
      scanner.clear();
      onCode(decoded);
    } catch (error) {
      setCameraError(
        `Couldn't read a barcode from that image — try a clearer, closer, well-lit photo, or enter the code manually.${
          error instanceof Error ? ` (${error.message})` : ""
        }`
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {!cameraActive && (
        <Button onClick={startCamera} className="w-full">
          <Camera className="size-4" />
          Scan with camera
        </Button>
      )}

      {/* Native-detector path renders into this <video> directly; it stays
          mounted permanently (visibility via className only) so it's never
          torn out from under a live stream. */}
      <video ref={videoRef} muted playsInline className={cameraActive ? "w-full rounded-xl" : "hidden"} />

      {/* html5-qrcode fallback path renders its own <video>/<canvas> into
          this div — kept separate from the one above so the two camera
          implementations never share (and fight over) the same DOM node. */}
      <div id={CAMERA_ELEMENT_ID} className={cameraActive ? "overflow-hidden rounded-xl" : "hidden"} />

      {cameraActive && (
        <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
          <X className="size-3.5" />
          Stop camera
        </Button>
      )}

      {/* Off-screen, not display:none — html5-qrcode's file-scan fallback
          draws the uploaded image onto an internal canvas here, which can
          end up zero-size (and silently fail to decode) inside a
          display:none container in some browsers. */}
      <div id={FILE_ELEMENT_ID} style={{ position: "fixed", top: -9999, left: -9999, width: 300, height: 300 }} />

      {cameraError && <p className="text-xs text-danger">{cameraError}</p>}

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)} />
      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={cameraActive}>
        <Upload className="size-4" />
        Upload a photo of the barcode
      </Button>

      <div className="flex gap-2">
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Or type the code manually"
          onKeyDown={(e) => {
            if (e.key === "Enter" && manualCode.trim()) onCode(manualCode.trim());
          }}
        />
        <Button variant="outline" onClick={() => manualCode.trim() && onCode(manualCode.trim())} disabled={!manualCode.trim()}>
          <Search className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
