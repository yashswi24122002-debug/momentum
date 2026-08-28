"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NATIVE_FORMATS = ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"];

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function hasNativeDetector(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector !== "undefined";
}

export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const zxingControlsRef = useRef<import("@zxing/browser").IScannerControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function stopNativeCamera() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function stopZxingCamera() {
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopNativeCamera();
      stopZxingCamera();
    };
  }, []);

  // Camera permission is only requested once this is actually called —
  // i.e. only after the user presses "Scan with camera" (PRD §7). Prefers
  // the browser's native BarcodeDetector (hardware-backed on Chrome/
  // Android, confirmed reliable on real-world 1D barcodes) and only falls
  // back to @zxing/browser — the PRD's own named fallback library — on
  // browsers without it (Safari/iOS and some others). html5-qrcode was
  // tried first for this fallback and never reliably decoded a real
  // barcode from a live camera even after several fixes; zxing is a more
  // mature, purpose-built decoder and shares the same <video> element, so
  // there's no second DOM node for the two engines to fight over.
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
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ]);
      const reader = new BrowserMultiFormatReader(hints);

      if (!videoRef.current) throw new Error("Video element not ready");
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (result) {
            onCode(result.getText());
            stopZxingCamera();
            setCameraActive(false);
          }
          // A per-frame "not found" error fires continuously while scanning — expected, ignored.
        }
      );
      zxingControlsRef.current = controls;
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Couldn't access the camera — try image upload or manual entry instead.");
      setCameraActive(false);
    }
  }

  function stopCamera() {
    stopNativeCamera();
    stopZxingCamera();
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

    const objectUrl = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(objectUrl);
      onCode(result.getText());
    } catch (error) {
      setCameraError(
        `Couldn't read a barcode from that image — try a clearer, closer, well-lit photo, or enter the code manually.${
          error instanceof Error ? ` (${error.message})` : ""
        }`
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
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

      {/* Shared by both the native-detector and zxing fallback paths —
          permanently mounted (visibility via className only) so a live
          stream is never torn out from under either engine. */}
      <video ref={videoRef} muted playsInline className={cameraActive ? "w-full rounded-xl" : "hidden"} />

      {cameraActive && (
        <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
          <X className="size-3.5" />
          Stop camera
        </Button>
      )}

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
