"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GenerateContext = {
  location: string;
  trip_stage: "general" | "planning" | "traveling" | "returned";
  format_preference: "any" | "reel" | "carousel";
};

const DEFAULT_CONTEXT: GenerateContext = {
  location: "",
  trip_stage: "general",
  format_preference: "any",
};

const TRIP_STAGE_OPTIONS: { value: GenerateContext["trip_stage"]; label: string }[] = [
  { value: "general", label: "General ideas (no specific trip)" },
  { value: "planning", label: "Planning an upcoming trip" },
  { value: "traveling", label: "Currently traveling" },
  { value: "returned", label: "Just got back from a trip" },
];

const FORMAT_OPTIONS: { value: GenerateContext["format_preference"]; label: string }[] = [
  { value: "any", label: "Any format" },
  { value: "reel", label: "Reel" },
  { value: "carousel", label: "Carousel" },
];

export function GenerateDialog({
  open,
  onOpenChange,
  onGenerate,
  generating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (context: GenerateContext) => void;
  generating: boolean;
}) {
  const [context, setContext] = useState<GenerateContext>(DEFAULT_CONTEXT);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate today&apos;s ideas</DialogTitle>
          <DialogDescription>
            All fields are optional — leave them as-is for general ideas, or fill in a location for something more specific.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Where are you traveling to / currently at?</Label>
            <Input
              value={context.location}
              onChange={(e) => setContext((c) => ({ ...c, location: e.target.value }))}
              placeholder="e.g. Vietnam, Goa, Ladakh (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Trip stage</Label>
            <Select
              value={context.trip_stage}
              onValueChange={(v) => setContext((c) => ({ ...c, trip_stage: (v as GenerateContext["trip_stage"]) ?? "general" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIP_STAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Format preference</Label>
            <Select
              value={context.format_preference}
              onValueChange={(v) =>
                setContext((c) => ({ ...c, format_preference: (v as GenerateContext["format_preference"]) ?? "any" }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={() => onGenerate(context)} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
