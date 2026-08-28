"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Retail barcode formats only (PRD §4: "EAN/UPC/Code 128 and more") — not
// QR codes, which would also decode but aren't what a packaged-food label
// ever uses.
const BARCODE_FORMATS = [9, 10, 5, 14, 15]; // EAN_13, EAN_8, CODE_128, UPC_A, UPC_E

const SCANNER_ELEMENT_ID = "calorie-barcode-scanner";

export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  // Camera permission is only requested once this is actually called —
  // i.e. only after the user presses "Scan with camera" (PRD §7).
  async function startCamera() {
    setCameraError(null);
    setCameraActive(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: BARCODE_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decodedText) => {
          onCode(decodedText);
          scanner.stop().catch(() => {});
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
    await scannerRef.current?.stop().catch(() => {});
    setCameraActive(false);
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, false);
      const decoded = await scanner.scanFile(file, false);
      onCode(decoded);
    } catch {
      setCameraError("Couldn't read a barcode from that image — try a clearer photo or enter the code manually.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {cameraActive ? (
        <div className="space-y-2">
          <div id={SCANNER_ELEMENT_ID} className="overflow-hidden rounded-xl" />
          <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
            <X className="size-3.5" />
            Stop camera
          </Button>
        </div>
      ) : (
        <Button onClick={startCamera} className="w-full">
          <Camera className="size-4" />
          Scan with camera
        </Button>
      )}

      {/* Kept mounted (hidden) even in camera mode so scanFile() always has its target element. */}
      {!cameraActive && <div id={SCANNER_ELEMENT_ID} className="hidden" />}

      {cameraError && <p className="text-xs text-danger">{cameraError}</p>}

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)} />
      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
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
