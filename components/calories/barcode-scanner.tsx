"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Retail barcode formats only (PRD §4: "EAN/UPC/Code 128 and more") — not
// QR codes, which would also decode but aren't what a packaged-food label
// ever uses.
const BARCODE_FORMATS = [9, 10, 5, 14, 15]; // EAN_13, EAN_8, CODE_128, UPC_A, UPC_E

// Two separate, permanently-mounted containers — one for the live camera
// scanner, one dedicated to file-upload decoding. Each is owned by its own
// Html5Qrcode instance for its whole lifetime. Previously these shared one
// div that was conditionally mounted/unmounted based on camera state; once
// html5-qrcode had injected its own <video>/<canvas> children into that
// node, React unmounting the div out from under a live camera stream (or
// a second Html5Qrcode instance targeting the same node for a file scan)
// crashed the whole renderer, not just this component — hence the "This
// page couldn't load" browser-level failure rather than an in-app error.
const CAMERA_ELEMENT_ID = "calorie-barcode-camera";
const FILE_ELEMENT_ID = "calorie-barcode-file";

// Wide and short, not square — a retail barcode is a horizontal strip, and
// a square/near-square box (the html5-qrcode default, tuned for QR codes)
// crops off the ends of the barcode before it can be read.
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
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
  // i.e. only after the user presses "Scan with camera" (PRD §7).
  async function startCamera() {
    setCameraError(null);
    setCameraActive(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        // Forces the bundled zxing-based decoder instead of the browser's
        // native BarcodeDetector API (html5-qrcode prefers native when
        // present, by default) — support/behavior for that API varies
        // enough across browsers/OSes that a real barcode scan was
        // silently failing on it; the JS decoder is the one path this is
        // actually tested against.
        useBarCodeDetectorIfSupported: false,
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
    const scanner = scannerRef.current;
    if (scanner) {
      await scanner.stop().catch(() => {});
      scanner.clear();
    }
    setCameraActive(false);
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(FILE_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: false,
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

      <div id={CAMERA_ELEMENT_ID} className={cameraActive ? "overflow-hidden rounded-xl" : "hidden"} />

      {cameraActive && (
        <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
          <X className="size-3.5" />
          Stop camera
        </Button>
      )}

      {/* Off-screen, not display:none — html5-qrcode draws the uploaded
          image onto an internal canvas here, which can end up zero-size
          (and silently fail to decode) inside a display:none container in
          some browsers. */}
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
