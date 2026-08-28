"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanBarcode, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FoodSearch } from "@/components/calories/food-search";
import { RecipeQuickLog } from "@/components/calories/recipe-quick-log";
import { todayLocalISODate } from "@/lib/date";

export function AddFoodFlow() {
  const router = useRouter();

  function handleLogged() {
    toast.success("Back to your dashboard…");
    router.push("/calories");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/calories" />} nativeButton={false}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">Add Food</h1>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="w-full">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="barcode">Barcode</TabsTrigger>
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="recipe">Recipe</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="pt-4">
          <FoodSearch logDate={todayLocalISODate()} onLogged={handleLogged} />
        </TabsContent>

        <TabsContent value="barcode" className="pt-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <ScanBarcode className="size-6 text-text-muted" />
            <p className="text-sm text-text-secondary">Barcode scanning is coming in the next update.</p>
            <p className="text-xs text-text-muted">Use Search for now — packaged foods you log manually will still show up as personal foods.</p>
          </div>
        </TabsContent>

        <TabsContent value="photo" className="pt-4">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <Camera className="size-6 text-text-muted" />
            <p className="text-sm text-text-secondary">Photo-assisted logging is coming in a later update.</p>
            <p className="text-xs text-text-muted">Search or Recipe covers Indian meals more reliably than a photo can anyway (oil/ghee is invisible to a camera).</p>
          </div>
        </TabsContent>

        <TabsContent value="recipe" className="pt-4">
          <RecipeQuickLog logDate={todayLocalISODate()} onLogged={handleLogged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
